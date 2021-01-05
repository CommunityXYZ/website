import { spawn, ModuleThread } from 'threads';

import $ from '../libs/jquery';
import { BalancesWorker } from '../workers/balances';
import { VotesWorker } from '../workers/votes';
import Utils from '../utils/utils';
import app from '../app';
import arweave from '../libs/arweave';
import Market from '../models/market';

export default class PageDashboard {
  // workers
  private firstCall = true;
  private balancesWorker: ModuleThread<BalancesWorker>;
  private votesWorker: ModuleThread<VotesWorker>;

  constructor() {}

  async open() {
    $('.page-dashboard').show();

    if (this.firstCall) {
      this.balancesWorker = await spawn<BalancesWorker>(new Worker('../workers/balances.ts'));
      this.votesWorker = await spawn<VotesWorker>(new Worker('../workers/votes.ts'));

      this.firstCall = false;
    }

    $('.link-home').addClass('active');
    this.syncPageState();
  }

  async close() {
    $('.link-home').removeClass('active');
    $('.page-dashboard').hide();
  }

  public async syncPageState() {
    const market = new Market(app.getCommunityId(), await app.getAccount().getWallet());
    if (await app.getAccount().isLoggedIn()) {
      market.showBuyButton();
    } else {
      market.hideBuyButton();
    }

    const state = await app.getCommunity().getState();

    const commDesc = state.settings.get('communityDescription') || '';
    const commAppUrl = state.settings.get('communityAppUrl') || '';

    $('.commId').text(app.getCommunityId());
    $('.comm-title').text(state.name);
    $('.comm-description').text(commDesc);
    $('.app-link').attr('href', commAppUrl).text(commAppUrl);

    const quorum = state.settings.get('quorum') * 100;
    const support = state.settings.get('support') * 100;
    const voteLength = state.settings.get('voteLength');
    const lockMinLength = state.settings.get('lockMinLength');
    const lockMaxLength = state.settings.get('lockMaxLength');

    $('.quorum').text(` ${quorum}%`);
    $('.support').text(` ${support}%`);
    $('.voteLength').text(` ${voteLength} blocks (${Utils.formatBlocks(voteLength)})`);
    $('.lockMinLength').text(` ${lockMinLength} blocks (${Utils.formatBlocks(lockMinLength)})`);
    $('.lockMaxLength').text(` ${lockMaxLength} blocks (${Utils.formatBlocks(lockMaxLength)})`);

    const links = state.settings.get('communityDiscussionLinks');
    if (links && links.length) {
      $('.comm-links').empty();
      links.forEach((link) => {
        $('.comm-links').append(`
        <div class="col-auto">
          <a href="${link}" class="small" target="_blank">${link}</a>
        </div>`);
      });
    }

    let logo = state.settings.get('communityLogo');
    if (logo && logo.length) {
      const config = arweave.api.getConfig();
      logo = `${config.protocol}://${config.host}:${config.port}/${logo}`;
    } else {
      logo = Utils.generateIcon(app.getCommunityId(), 96);
    }
    $('.comm-logo').css('background-image', `url(${logo})`);

    const { users, balance } = await this.balancesWorker.usersAndBalance(state.balances);
    const { vaultUsers, vaultBalance } = await this.balancesWorker.vaultUsersAndBalance(state.vault);

    let nbUsers = users.length;
    nbUsers += vaultUsers.filter((user) => !users.includes(user)).length;

    $('.users').text(nbUsers).parents('.dimmer').removeClass('active');
    $('.users-vault').text(`${vaultUsers.length} `);

    const votes = await this.votesWorker.activeVotesByType(state.votes);
    const votesMint = votes.mint ? votes.mint.length : 0;
    const votesVault = votes.mintLocked ? votes.mintLocked.length : 0;
    const votesActive = votes.active ? votes.active.length : 0;
    const votesAll = votes.all ? votes.all.length : 0;

    $('.minted').text(Utils.formatMoney(balance + vaultBalance, 0));
    $('.mint-waiting').text(`${votesMint} `).parents('.dimmer').removeClass('active');
    $('.vault').text(Utils.formatMoney(vaultBalance, 0));
    $('.vault-waiting').text(`${votesVault} `).parents('.dimmer').removeClass('active');
    $('.ticker').text(` ${state.ticker} `);
    $('.votes').text(`${votesActive} `);
    $('.votes-completed')
      .text(`${votesAll - votesActive} `)
      .parents('.dimmer')
      .removeClass('active');
  }
}
