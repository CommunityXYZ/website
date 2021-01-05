import { expose } from 'threads/worker';
import { BalancesInterface, VaultInterface, VoteInterface } from 'community-js/lib/faces';

const worker = {
  activeVotesByType: (votes) => {
    const res: { [key: string]: VoteInterface[] } = {};

    function addVote(type: string, vote: VoteInterface) {
      if (res[type]) {
        res[type].push(vote);
      } else {
        res[type] = [vote];
      }
    }

    for (let i = 0, j = votes.length; i < j; i++) {
      const vote = votes[i];
      addVote('all', vote);

      if (vote.status === 'active') {
        addVote('active', vote);
        addVote(vote.type, vote);
      }
    }

    return res;
  },
};

export type VotesWorker = typeof worker;
expose(worker);
