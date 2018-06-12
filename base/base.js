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
    constructor(height){
        this.propagation_count = 0;
        this.height = height;
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
        let node_generator  = new NodeGenerator(maxNetworkNodeCount, 2, 2, 4, 8);
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

module.exports.Node = Node;
module.exports.Block = Block;
module.exports.NodeGenerator = NodeGenerator;
module.exports.NetworkGenerator = NetworkGenerator;