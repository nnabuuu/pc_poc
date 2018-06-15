'use strict'

const _ = require('lodash');
const Node = require('./propagation_simulator').Node;
const Block = require('./propagation_simulator').Block;

const PC_ADAPT_RATE = 0.2;

//Bitcoin node
class PCAdaptedNode extends Node{
    constructor(index, is_pc_adapted = false){
        super(index);
        this.is_pc_adapted = is_pc_adapted;
    }

    receive(block) {
        //Reject duplicate block
        if(block.height <= this.chainHeightReached) {
            return false;
        }

        this.chainHeightReached = block.height;

        if(this.callback) {
            this.callback(block);
        }

        return true;
    }


}

//Generate node
class PCNodeGenerator {

    constructor(maxNetworkNodeCount, minInbound, maxInbound, minOutbound, maxOutbound, pc_adapted_rate){
        this.maxNetworkNodeCount = maxNetworkNodeCount;
        this.minInbound = minInbound;
        this.maxInbound = maxInbound;
        this.minOutbound = minOutbound;
        this.maxOutbound = maxOutbound;
        this.pc_adapted_chance = pc_adapted_rate;
    }

    new_node(index){

        let pc_adapted = _.random(0, 1, true) <= this.pc_adapted_chance;

        let pc_adapted_node = new PCAdaptedNode(index, pc_adapted);

        let inbound_count = _.random(this.minInbound, this.maxInbound);
        let outbound_count = _.random(this.minOutbound, this.maxOutbound);

        //Don't connect to itself , it might cause infinite loop (or not?)
        let exceptions = [index];

        for(let i = 0; i < inbound_count; i++) {
            let rand = random_except(0, this.maxNetworkNodeCount - 1, exceptions);
            pc_adapted_node.inBoundPeerIndexes.push(rand);
            exceptions.push(rand);
        }

        for(let i = 0; i < outbound_count; i++) {
            let rand = random_except(0, this.maxNetworkNodeCount - 1, exceptions);
            pc_adapted_node.outBoundPeerIndexes.push(rand);
            exceptions.push(rand);
        }

        return pc_adapted_node;
    }

    new_pc_node(){

        //Pc node won't connect to itself
        let pc_node = new PCAdaptedNode(-1, false);

        pc_node.callback = (block) => {
            console.log("PC node received block after " + block.propagation_count + " propagation");
        };

        return pc_node;

    }
}

//Generate pc adapted bitcoin network
class PCNetworkGenerator{

    new_network(maxNetworkNodeCount){
        let node_generator  = new PCNodeGenerator(maxNetworkNodeCount, 2, 2, 2, 8, PC_ADAPT_RATE);

        let network = [];

        //Simulate pc network as a super single node
        let super_pc_node = node_generator.new_pc_node();

        network.push(super_pc_node);

        for(let i = 0; i < maxNetworkNodeCount; i++) {
            let node = node_generator.new_node(i);
            network.push(node);
        }

        this.fulfill(network, super_pc_node);

        return network;
    }

    fulfill(network, super_pc_node) {
        _.forEach(network, (node) => {
            node.inBoundPeers = _.map(node.inBoundPeerIndexes, (peer_index) => network[peer_index]);
            node.outBoundPeers = _.map(node.outBoundPeerIndexes, (peer_index) => network[peer_index]);

            if(node.is_pc_adapted) {
                node.outBoundPeers.push(super_pc_node);
                super_pc_node.outBoundPeers.push(node);
            }
        })


    }
}

function random_except(min, max, exceptions) {
    let rand = _.random(min, max);

    while(_.includes(exceptions, rand)) {
        rand = _.random(min, max);
    }

    return rand;
}

//Run the simulation
class PCAdaptedNetworkSimulator{

    //Simulate a block mined within the network, check after how many jumps the observer receives the block
    constructor(network, observer_index = 5000) {
        this.network = network;

        let observer = network[observer_index];
        observer.callback = (block) => {
            console.log("Node "+ observer_index+ " receive block after " + block.propagation_count + " propagation");
        }


    }


    simulate_block_propagation() {
        let node_receive_block = 1;
        let block = new Block(1);
        let nodes = this.propagate([this.network[_.random(1, _.size(this.network) - 1)]], block);
        while(!_.isEmpty(nodes)) {
            node_receive_block += _.size(nodes);
            console.log("After " + block.propagation_count + " propagation, " + node_receive_block + " nodes have received the block")
            nodes = this.propagate(nodes, block);
        }

        return block.propagation_count;
    }

    propagate(nodes, block) {
        let new_received_nodes = [];

        block.propagation_count++;

        _.forEach(nodes, (node) => {
            new_received_nodes = _.concat(new_received_nodes, _.filter(node.outBoundPeers, (peer) => {
                return peer.receive(block);
            }))
        });

        return new_received_nodes;
    }


}

function main() {
    let pc_network_generator = new PCNetworkGenerator();
    //A network of 10000 nodes
    let pc_network = pc_network_generator.new_network(10000);
    let pc_adapted_network_simulator = new PCAdaptedNetworkSimulator(pc_network);
    pc_adapted_network_simulator.simulate_block_propagation();
}

if (typeof require != 'undefined' && require.main == module) {
    main();
}


