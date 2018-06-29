let _ = require('lodash');

const N = 4;
const T = 1;
const PROPOSAL_NUMBER = 4;

//A normal pine master node
class PM {
    constructor(index, ranking_array){
        this.index = index;
        this.ranking = new Ranking(ranking_array);
        this.fixed_proposal = [];

        this.profile = new Profile(PROPOSAL_NUMBER, N, T);

        this.is_malicious = false;
    }

    broadcasted_ranking(){
        console.log("Pm " + this.index + " broadcasts ranking: " + this.ranking.ranking_array);
        return this.ranking;
    }

    update_ranking_from_fixed_proposal(fixed_proposal) {
        let changed = false;

        for(let i = 0; i < fixed_proposal.length; i++) {
            let proposal = fixed_proposal[i];
            changed = changed || this._update_single_ranking(proposal);
        }

        if(changed) {
            this.update_ranking_from_fixed_proposal(fixed_proposal);
        }
        else {
            this.fixed_proposal = fixed_proposal;
            console.log("Pm " + this.index + " ranking after adapting fixed proposal is: ");
            console.log(this.ranking.ranking_array);
        }
    }

    _update_single_ranking(single_proposal) {
        let index0 = _.indexOf(this.ranking.ranking_array, single_proposal[0]);
        let index1 = _.indexOf(this.ranking.ranking_array, single_proposal[1]);
        if(index0 > index1) {
            this.ranking.ranking_array[index0] = single_proposal[1];
            this.ranking.ranking_array[index1] = single_proposal[0];
            console.log("PM " + this.index +" swap rank of " + single_proposal + " according to fixed proposal" );
            return true;
        }
        return false;
    }

    validate_dictator_ranking(dictator_ranking) {
        //If dictator's ranking agrees with fixed_proposal, change my ranking to dictator's ranking.
        console.log("Pm " + this.index + " validator dictator's ranking using fixed proposal");
        console.log(this.fixed_proposal);
        if( dictator_ranking.agrees_with_proposals(this.fixed_proposal)){
            this.ranking = dictator_ranking;
            console.log("Pm " + this.index + " changes self ranking to dictator's ranking since it agrees with fixed proposal");
        }
        else {
            console.log("Pm " + this.index + " reject dictator's ranking since it disagrees with fixed proposal");
        }
    }

    clean_up_profile(){
        this.profile = new Profile(PROPOSAL_NUMBER, N, T);
    }

}

class Profile {
    constructor(proposal_size, n, t){
        this.proposal_size = proposal_size;
        this.proposal_map = [];
        for(let i = 0; i < proposal_size; i++) {
            let single_line_proposal = [];
            for(let j = 0; j < proposal_size; j++) {
                single_line_proposal.push(0);
            }
            this.proposal_map.push(single_line_proposal);
        }
        this.n = n;
        this.t = t;
    }

    accept_ranking(ranking) {
        let ranking_proposal = ranking.to_proposal();
        for(let i = 0; i < ranking_proposal.length; i++) {
            let single_proposal_pair = ranking_proposal[i];

            let large_index = single_proposal_pair[0].charCodeAt(0) - 'a'.charCodeAt(0);
            let small_index = single_proposal_pair[1].charCodeAt(0) - 'a'.charCodeAt(0);

            //Like 'b' > 'c', then proposal_map[1][2] would increment by 1
            this.proposal_map[large_index][small_index]++;
        }
    }

    fixed_proposal(){
        let fixed_proposal = [];
        for(let i = 0; i < this.proposal_size; i++) {
            for(let j = 0; j < this.proposal_size; j++) {
                if(this.proposal_map[i][j] >= this.n - this.t) {
                    fixed_proposal.push([String.fromCharCode('a'.charCodeAt(0) + i), String.fromCharCode('a'.charCodeAt(0)+ j)]);
                }
            }
        }
        return fixed_proposal;
    }
}

class Ranking {
    constructor(ranking_array){
        this.ranking_array = ranking_array;
    }

    to_proposal(){
        let proposal = [];
        for(let i = 0; i < this.ranking_array.length; i++) {
            for(let j = i + 1; j < this.ranking_array.length; j++) {
                proposal.push([this.ranking_array[i], this.ranking_array[j]]);
            }
        }
        return proposal;
    }

    agrees_with_proposals(proposals) {
        for(let i = 0; i < proposals.length; i++) {
            if(!this._agree_with_proposal(proposals[i])) {
                return false;
            }
        }
        return true;
    }

    _agree_with_proposal(proposal) {
        return _.indexOf(this.ranking_array, proposal[0]) < _.indexOf(this.ranking_array, proposal[1]);
    }
}


function main() {
    let pm0 = new PM(0, ['a', 'c', 'd']);
    let pm1 = new PM(1, ['a', 'b', 'c', 'd']);
    let pm2 = new PM(2, ['d', 'c', 'a', 'b']);
    let pm3 = new PM(3, ['c', 'd', 'a', 'b']);

    let pms = [pm0, pm1, pm2, pm3];

    for (let i = 0; i <= T; i++) {

        console.log("Round " + i + " begin -------------------");

        _.map(pms, (pm) => {pm.clean_up_profile()});

        console.log("Round " + i + " Communication Phase:");

        let dictator = pms[i];

        let pm_rankings = _.map(pms, (pm) => {
            return _.cloneDeep(pm.ranking)});

        for(let j = 0; j < N; j++) {
            let local_pm = pms[j];

            for(let k = 0; k < N; k++) {
                console.log("Pm " + local_pm.index + " receives ranking from pm " + k);
                local_pm.profile.accept_ranking(pm_rankings[k]);
            }

            console.log("PM " + j + "'s profile map after round " + i + " :");
            console.log(local_pm.profile.proposal_map);

            let fixed_proposal = local_pm.profile.fixed_proposal();

            console.log("PM " + j + " sees fixed proposal:");
            console.log(fixed_proposal);

            local_pm.update_ranking_from_fixed_proposal(fixed_proposal);

        }


        console.log("Round " + i + " Dictator Phase:");

        console.log("Round " + i + " Decision Phase:");

        _.map(pms, (pm) => {
            pm.validate_dictator_ranking(dictator.broadcasted_ranking());
        });

        console.log("Round " + i + " end -------------------");
    }

    console.log("-------------------");
    _.map(pms, (pm) => {
        console.log("Final ranking of pm " + pm.index + ": " + pm.ranking.ranking_array + " malicious? " + pm.is_malicious);
    })
}

main();


module.exports.Ranking = Ranking;
module.exports.Profile = Profile;
module.exports.PM = PM;