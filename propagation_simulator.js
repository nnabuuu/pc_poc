const _ = require('lodash');
const NetworkGenerator = require('./base/base').NetworkGenerator;
const Block = require('./base/base').Block;

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

        _.forEach(nodes, (node) => {
            new_received_nodes = _.concat(new_received_nodes, _.filter(node.outBoundPeers, (peer) => {
                return peer.receive(block);
            }))
        });

        block.propagation_count++;

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

main();


