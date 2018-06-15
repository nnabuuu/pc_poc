'use strict'

const _ = require('lodash');
const Node = require('./propagation_simulator').Node;
const Block = require('./propagation_simulator').Block;

const PC_ADAPT_RATE = 0.2;

const assert = require('assert');

const BLOCK_SIZE = 32000;
const MIN_INBOUND = 2;
const MAX_INBOUND = 2;
const MIN_OUTBOUND = 2;
const MAX_OUTBOUND = 8;
const MIN_BANDWIDTH = 500;
const MAX_BANDWIDTH = 500;


//Bitcoin node
class PCAdaptedTimedNode {
    constructor(index, bandwidth, is_pc_adapted = false){
        this.index = index;
        this.inBoundPeerIndexes = [];
        this.outBoundPeerIndexes = [];
        this.inBoundPeers = [];
        this.outBoundPeers = [];

        this.chainHeightReached = 0;
        this.callback = undefined;

        this.is_pc_adapted = is_pc_adapted;

        this.bandwidth = bandwidth;
        this.active_bandwidth = bandwidth;
        this.is_receiving_block = false;
        this.progress = 0;
        this.chain_height_reached = 0;
        this.done = true;
    }

    active_bandwidth(active_bandwidth) {
        this.active_bandwidth = active_bandwidth;
        return this;
    }

    //receive and process for 100ms
    receive(block){

        //New block arrives
        if(!this.is_receiving_block) {

            assert.equal(this.progress, 0);

            //Reject duplicate block
            if(block.height <= this.chain_height_reached) {
                return false;
            }

            this.done = false;
            this.chain_height_reached = block.height;
            this.is_receiving_block = true;

            this.progress = 0.1 * this.active_bandwidth;

        } else {

            this.progress += 0.1 * this.active_bandwidth;

            if(this.progress >= block.size) {
                this.progress = 0;
                this.is_receiving_block = false;
                this.done = true;
                this.active_bandwidth = this.bandwidth;
            }

        }

        if(this.done && this.callback) {
            this.callback(block);
        }

        return this.done;
    }

}

class PCAdaptedTimedNodeGenerator {
    constructor(maxNetworkNodeCount, minInbound, maxInbound, minOutbound, maxOutbound, minBandwidth, maxBandwidth, pc_adapt_rate){
        this.maxNetworkNodeCount = maxNetworkNodeCount;
        this.minInbound = minInbound;
        this.maxInbound = maxInbound;
        this.minOutbound = minOutbound;
        this.maxOutbound = maxOutbound;

        this.minBandwidth = minBandwidth;
        this.maxBandwidth = maxBandwidth;
        this.pc_adapt_rate = pc_adapt_rate;
    }

    new_pc_adapted_timed_node(index){

        let pc_adapted = _.random(0, 1, true) <= this.pc_adapt_rate;

        let bandwidth = _.random(this.minBandwidth, this.maxBandwidth);

        let pc_adapted_timed_node = new PCAdaptedTimedNode(index, bandwidth, pc_adapted);

        let inbound_count = _.random(this.minInbound, this.maxInbound);
        let outbound_count = _.random(this.minOutbound, this.maxOutbound);

        let exceptions = [index];
        for(let i = 0; i < inbound_count; i++) {
            let rand = random_except(0, this.maxNetworkNodeCount - 1, exceptions);
            pc_adapted_timed_node.inBoundPeerIndexes.push(rand);
            exceptions.push(rand);
        }

        for(let i = 0; i < outbound_count; i++) {
            let rand = random_except(0, this.maxNetworkNodeCount - 1, exceptions);
            pc_adapted_timed_node.outBoundPeerIndexes.push(rand);
            exceptions.push(rand);
        }

        return pc_adapted_timed_node;
    }

    new_pc_node(){

        //Pc node won't connect to itself
        let pc_node = new PCAdaptedTimedNode(-1, 1000000, false);

        pc_node.callback = (block) => {
            console.log("PC node received block.");
        };

        return pc_node;

    }

}

//Generate pc adapted bitcoin network
class PCTimedNetworkGenerator{

    new_network(maxNetworkNodeCount){
        let node_generator  = new PCAdaptedTimedNodeGenerator(
            maxNetworkNodeCount,
            MIN_INBOUND,
            MAX_INBOUND,
            MIN_OUTBOUND,
            MAX_OUTBOUND,
            MIN_BANDWIDTH,
            MAX_BANDWIDTH,
            PC_ADAPT_RATE);

        let network = [];

        //Simulate pc network as a super single node
        let super_pc_node = node_generator.new_pc_node();

        network.push(super_pc_node);

        for(let i = 0; i < maxNetworkNodeCount; i++) {
            let node = node_generator.new_pc_adapted_timed_node(i);
            network.push(node);
        }

        this.fulfill(network, super_pc_node);

        return network;
    }

    fulfill(network, super_pc_node) {

        let pc_adapted_node_count = 0;

        _.forEach(network, (node) => {
            node.inBoundPeers = _.map(node.inBoundPeerIndexes, (peer_index) => network[peer_index]);
            node.outBoundPeers = _.map(node.outBoundPeerIndexes, (peer_index) => network[peer_index]);

            if(node.is_pc_adapted) {
                node.outBoundPeers.push(super_pc_node);
                super_pc_node.outBoundPeers.push(node);
                pc_adapted_node_count++;
            }
        })

        console.log("Network fulfilled, " + pc_adapted_node_count + " nodes adapt to pc");
    }
}

//Run the simulation
class PCAdaptedTimedNetworkSimulator{

    //Simulate a block mined within the network, check after how many jumps the observer receives the block
    constructor(network, observer_index = 5000) {

        this.network = network;

        let observer = network[observer_index];
        observer.callback = (block) => {
            console.log("Node "+ observer_index+ " receive block after " + block.propagation_count + " propagation");
        }

        this.time = 0;
        this.active_nodes = []

    }


    simulate_block_propagation() {
        this.time = 0;
        this.propergated_nodes_count = 1;

        let block = new Block(1, BLOCK_SIZE);

        this.active_nodes = [this.network[_.random(1, _.size(this.network) - 1)]];

        while(!_.isEmpty(this.active_nodes)) {
            this.time += 100;

            let candidate_nodes = [];
            //Validate each node, remove inactive nodes
            _.forEach(this.active_nodes, (active_node) => {
                if(active_node.done && active_node.chain_height_reached >= block.height) {

                    this.propergated_nodes_count++;

                    //Add inactive node's outbound peer to active list
                    let unreached_outbound_nodes = _.filter(active_node.outBoundPeers, (peer) => {
                        return peer.done && peer.chain_height_reached < block.height;
                    })

                    //Adjust active bandwidth
                    _.forEach(unreached_outbound_nodes, (candidate_node) => {
                        candidate_node.active_bandwidth = _.min([candidate_node.bandwidth, active_node.bandwidth])
                    });

                    candidate_nodes = _.concat(candidate_nodes, unreached_outbound_nodes);
                }
            });

            this.active_nodes = _.concat(this.active_nodes, candidate_nodes);

            this.active_nodes = _.uniq(this.active_nodes);

            //Remove inactive node
            _.remove(this.active_nodes, (active_node) => {
                return active_node.done && active_node.chain_height_reached >= block.height;
            })

            //Processing each active node

            _.forEach(this.active_nodes, (active_node) => {
                active_node.receive(block)
            });

            console.log("Simulation time elapsed: " + this.time + "ms, " + this.propergated_nodes_count + " nodes reached");

        }
    }

}

function main() {
    let pc_timed_network_generator = new PCTimedNetworkGenerator();
    //A network of 10000 nodes
    let pc_timed_network = pc_timed_network_generator.new_network(10000);
    let pc_adapted_timed_network_simulator = new PCAdaptedTimedNetworkSimulator(pc_timed_network);
    pc_adapted_timed_network_simulator.simulate_block_propagation();
}

if (typeof require != 'undefined' && require.main == module) {
    main();
}

function random_except(min, max, exceptions) {
    let rand = _.random(min, max);

    while(_.includes(exceptions, rand)) {
        rand = _.random(min, max);
    }

    return rand;
}