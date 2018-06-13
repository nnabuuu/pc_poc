'use strict'

const _ = require('lodash');
const NodeGenerator = require('./propagation_simulator').NodeGenerator;
const NetworkGenerator = require('./propagation_simulator').NetworkGenerator;
const Block = require('./propagation_simulator').Block;
const Node = require('./propagation_simulator').Node;

const assert = require('assert');

const BLOCK_SIZE = 32000;

class TimedNode {
    constructor(index, bandwidth){
        this.index = index;
        this.inBoundPeerIndexes = [];
        this.outBoundPeerIndexes = [];
        this.inBoundPeers = [];
        this.outBoundPeers = [];

        this.chainHeightReached = 0;
        this.callback = undefined;

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

        return this.done;
    }
}

class TimedNodeGenerator extends NodeGenerator {
    constructor(maxNetworkNodeCount, minInbound, maxInbound, minOutbound, maxOutbound, minBandwidth, maxBandwidth){
        super(maxNetworkNodeCount, minInbound, maxInbound, minOutbound, maxOutbound);
        this.minBandwidth = minBandwidth;
        this.maxBandwidth = maxBandwidth;
    }

    new_timed_node(index){

        let bandwidth = _.random(this.minBandwidth, this.maxBandwidth);

        let node = new TimedNode(index, bandwidth);

        let inbound_count = _.random(this.minInbound, this.maxInbound);
        let outbound_count = _.random(this.minOutbound, this.maxOutbound);

        let exceptions = [index];
        for(let i = 0; i < inbound_count; i++) {
            let rand = random_except(0, this.maxNetworkNodeCount - 1, exceptions);
            node.inBoundPeerIndexes.push(rand);
            exceptions.push(rand);
        }

        for(let i = 0; i < outbound_count; i++) {
            let rand = random_except(0, this.maxNetworkNodeCount - 1, exceptions);
            node.outBoundPeerIndexes.push(rand);
            exceptions.push(rand);
        }

        return node;
    }

}

//Generate bitcoin network
class TimedNetworkGenerator{

    new_network(maxNetworkNodeCount){
        let node_generator  = new TimedNodeGenerator(maxNetworkNodeCount, 2, 2, 4, 8, 200, 800);
        let network = [];
        for(let i = 0; i < maxNetworkNodeCount; i++) {
            let node = node_generator.new_timed_node(i);
            network.push(node);
        }

        this.fulfill(network);

        return network;
    }

    fulfill(network) {
        _.forEach(network, (node) => {
            node.inBoundPeers = _.map(node.inBoundPeerIndexes, (peer_index) => network[peer_index]);
            node.outBoundPeers = _.map(node.outBoundPeerIndexes, (peer_index) => network[peer_index]);
        })
    }
}

class TimedNetworkSimulator{
    //Simulate a block mined within the network, check after how many jumps the observer receives the block
    constructor(network, observer_index = 5000) {
        this.network = network;

        let observer = network[observer_index];
        observer.callback = (block) => {
            console.log("Node "+ observer_index+ " receive block after " + block.propagation_count + " propagation");
        }

        this.time = 0;
        this.active_nodes = [];
    }


    simulate_block_propagation() {

        this.time = 0;
        this.propergated_nodes_count = 1;

        let block = new Block(1, BLOCK_SIZE);
        this.active_nodes.push(this.network[0]);

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

function random_except(min, max, exceptions) {
    let rand = _.random(min, max);

    while(_.includes(exceptions, rand)) {
        rand = _.random(min, max);
    }

    return rand;
}

function main() {
    let network_generator = new TimedNetworkGenerator();
    //A network of 10000 nodes
    let network = network_generator.new_network(10000);
    let network_simulator = new TimedNetworkSimulator(network);
    network_simulator.simulate_block_propagation();
}

main();