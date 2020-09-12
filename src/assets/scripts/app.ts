import "../styles/board.scss";

import "threads/register";
import Arweave from 'arweave';
import Community from 'community-js';
import $ from './libs/jquery';
import "bootstrap/dist/js/bootstrap.bundle";

import './global';
import PageDashboard from "./pages/dashboard";
import PageTokens from "./pages/tokens";
import PageVotes from "./pages/votes";
import PageVault from "./pages/vault";
import Account from "./models/account";
import Utils from "./utils/utils";
import Statusify from "./utils/statusify";

class App {
  private hash: string;
  private hashes: string[];
  private arweave: Arweave;
  private community: Community;
  private account: Account;
  private statusify: Statusify;
  private currentBlock: number = 0;

  private firstCall = true;
  
  // Pages`
  private currentPage: PageDashboard | PageTokens | PageVotes | PageVault; // Add all possible page objects here
  private pageDashboard: PageDashboard;
  private pageTokens: PageTokens;
  private pageVotes: PageVotes;
  private pageVault: PageVault;

  constructor() {
    this.arweave = Utils.createArweaveInstance();
    
    this.community = new Community(this.arweave);
    this.account = new Account(this.arweave, this.community);
    this.statusify = new Statusify(this.arweave);

    this.pageDashboard = new PageDashboard();
    this.pageTokens = new PageTokens();
    this.pageVotes = new PageVotes();
    this.pageVault = new PageVault();

    this.hashChanged(false);
  }

  getCommunity() {
    return this.community;
  }
  getArweave() {
    return this.arweave;
  }
  getAccount() {
    return this.account;
  }
  getStatusify() {
    return this.statusify;
  }
  getCurrentBlock() {
    return this.currentBlock;
  }
  getCurrentPage() {
    return this.currentPage;
  }
  getPageDashboard() {
    return this.pageDashboard;
  }
  getPageTokens() {
    return this.pageTokens;
  }
  getPageVotes() {
    return this.pageVotes;
  }
  getPageVault() {
    return this.pageVault;
  }

  async init() {
    if(!this.firstCall) {
      return;
    }
    this.firstCall = false;

    await this.updateNetworkInfo();
    this.checkVersion();
    const t = await this.community.setCommunityTx(this.hashes[0]);
    $('body').show();
    
    await this.updateLinks();
    await this.pageChanged();
    await this.account.init();

    this.events();
  }

  private async updateNetworkInfo() {
    this.currentBlock = (await this.arweave.network.getInfo()).height;

    setTimeout(() => this.updateNetworkInfo(), 60000);
  }

  private async checkVersion() {
    const mainId = await this.community.getMainContractId();
    const communityId = this.hashes[0];

    const query = {
      query: `
      query{
        main: transaction(
          id: "${mainId}"
        ){
          tags {
            name,
            value
          }
        }
        community: transaction(
          id: "${communityId}"
        ){
          tags {
            name,
            value
          }
        }
      }
      `
    };

    const res = await this.arweave.api.request().post('https://arweave.dev/graphql', query);
    if(!res.data || !res.data.data) {
      return;
    }

    let contracts = [];
    const communityTags = res.data.data.community.tags;
    const mainTags = res.data.data.main.tags;
    
    for(let i = 0; i < communityTags.length; i++) {
      if(communityTags[i].name === 'Contract-Src') {
        contracts.push(communityTags[i].value);
        break;
      }
    }

    for(let i = 0; i < mainTags.length; i++) {
      if(mainTags[i].name === 'Contract-Src') {
        contracts.push(mainTags[i].value);
        break;
      }
    }

    if(contracts[0] === contracts[1]) {
      return;
    }

    // TODO: Show the alert
    $('.alert-version').removeClass('d-none');
  }

  private async getPageStr(): Promise<string> {
    return this.hashes[1] || 'home';
  }

  private async updateLinks() {
    $('a').not('[data-toggle]').each((i: number, e: Element) => {
      const link = $(e).attr('href').split('#');
      if(link.length > 1 && link[1] !== '!' && !link[1].startsWith(this.hashes[0])) {
        $(e).attr('href', `#${this.hashes[0]}${link[1]}`);
      }
    });
  }

  private async hashChanged(updatePage = true) {
    this.hash = location.hash.substr(1);
    const hashes = this.hash.split('/');
    if(this.hashes && this.hashes[0] !== hashes[0]) {
      window.location.reload();
    }

    this.hashes = hashes;
    
    // To be able to access the dashboard, you need to send a Community txId.
    if(!this.hashes.length || !(/^[a-z0-9-_]{43}$/i.test(this.hashes[0]))) {
      window.location.href = './home.html';
    }

    if(updatePage) {
      await this.pageChanged();
    }
  }

  private async pageChanged() {
    $('.dimmer').addClass('active');

    if(this.currentPage) {
      this.currentPage.close();
    }

    const page = await this.getPageStr();
    if(page === 'home') {
      this.currentPage = this.pageDashboard;
    } else if(page === 'tokens') {
      this.currentPage = this.pageTokens;
    } else if(page === 'votes') {
      this.currentPage = this.pageVotes;
    } else if(page === 'vault') {
      this.currentPage = this.pageVault;
    }

    // @ts-ignore
    window.currentPage = this.currentPage;

    await this.updateTxFee();
    await this.currentPage.open();
    $('.page-header').find('.page-title').text((await this.community.getState()).name);
  }

  private async updateTxFee() {
    const fee = await this.community.getActionCost(true, {formatted: true, decimals: 5, trim: true});
    $('.tx-fee').text(fee);

    setTimeout(() => this.updateTxFee(), 60000);
  }

  private async events() {
    $(window).on('hashchange', () => {
      this.hashChanged();
    });

    $(document).on('input', '.input-number', (e: any) => {
      const $target = $(e.target);
      const newVal = +$target.val().toString().replace(/[^0-9]/g, '');
      $target.val(newVal);
  
      if($target.hasClass('percent') && newVal > 99) {
        $target.val(99);
      }
    });
  }
}

const app = new App();
export default app;

$(document).ready(() => {
  app.init();
});