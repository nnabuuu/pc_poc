'use strict'

const _ = require('lodash')

//Bitcoin node
class Node {
    constructor(index){
        this.index = index;
        this.inBoundPeerIndexes = [];
        this.outBoundPeerIndexes = [];
        this.inBoundPeers = [];
        this.outBoundPeers = [];

        this.chainHeightReached = 0;
        this.callback = undefined;
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

//Block
class Block {
    constructor(height, size = 1000){
        this.propagation_count = 0;
        this.height = height;
        this.size = size;
    }
}

//Generate node
class NodeGenerator {

    constructor(maxNetworkNodeCount, minInbound, maxInbound, minOutbound, maxOutbound){
        this.maxNetworkNodeCount = maxNetworkNodeCount;
        this.minInbound = minInbound;
        this.maxInbound = maxInbound;
        this.minOutbound = minOutbound;
        this.maxOutbound = maxOutbound;
    }

    new_node(index){
        let node = new Node(index);

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
class NetworkGenerator{

    new_network(maxNetworkNodeCount){
        let node_generator  = new NodeGenerator(maxNetworkNodeCount, 2, 2, 2, 8);
        let network = [];
        for(let i = 0; i < maxNetworkNodeCount; i++) {
            let node = node_generator.new_node(i);
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

function random_except(min, max, exceptions) {
    let rand = _.random(min, max);

    while(_.includes(exceptions, rand)) {
        rand = _.random(min, max);
    }

    return rand;
}

//Run the simulation
class NetworkSimulator{

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
        let nodes = this.propagate([this.network[0]], block);
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
    let network_generator = new NetworkGenerator();
    //A network of 10000 nodes
    let network = network_generator.new_network(10000);
    let network_simulator = new NetworkSimulator(network);
    network_simulator.simulate_block_propagation();
}

if (typeof require != 'undefined' && require.main == module) {
    main();
}


module.exports.Node = Node;
module.exports.Block = Block;
module.exports.NodeGenerator = NodeGenerator;
module.exports.NetworkGenerator = NetworkGenerator;


