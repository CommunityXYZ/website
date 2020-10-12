import { JWKInterface } from "arweave/web/lib/wallet";

import $ from '../libs/jquery';
import Toast from '../utils/toast';
import Community from "community-js";
import { getIdenticon, get } from "../utils/arweaveid";
import arweave from "../libs/arweave";
import communityDB from "../libs/db";

export default class Account {
  private community: Community;

  private loggedIn: boolean = false;
  private wallet: JWKInterface;
  private username: string = '';
  private avatar: string = '';
  private address: string = '';
  private arBalance: number = -1;
  private isInitialized: boolean = false;

  constructor(community: Community) {
    this.community = community;
  }

  async init() {
    try {
      const sess = atob(communityDB.get('sesswall'));
      if(sess) {
        await this.loadWallet(JSON.parse(sess));
      }
    } catch(e) {
      console.log(e);
    }

    this.events();
    this.isInitialized = true;
  }

  async getArweaveId(address: string = this.address) {
    return get(address);
  }
  async getIdenticon(address: string = this.address): Promise<string> {
    return getIdenticon(address);
  }
  async isLoggedIn(): Promise<boolean> {
    if(!this.isInitialized) {
      await this.init();
    }

    return this.loggedIn;
  }
  async getWallet(): Promise<JWKInterface> {
    return this.wallet;
  }
  async getAddress(): Promise<string> {
    return this.address;
  }

  async getArBalance(): Promise<number> {
    this.arBalance = +arweave.ar.winstonToAr((await arweave.wallets.getBalance(this.address)), { formatted: true, decimals: 5, trim: true });
    return this.arBalance;
  }

  async showLoginError(duration: number = 5000) {
    const toast = new Toast();
    toast.show('Login first', 'Before being able to do this action you need to login.', 'login', duration);
  }

  // Setters
  private async loadWallet(wallet: JWKInterface) {
    this.wallet = wallet;

    this.address = await this.community.setWallet(wallet);
    this.arBalance = +arweave.ar.winstonToAr((await arweave.wallets.getBalance(this.address)), { formatted: true, decimals: 5, trim: true });

    const acc = await get(this.address);
    this.username = acc.name;
    this.avatar = acc.avatarDataUri || getIdenticon(this.address);

    $('.user-name').text(this.username);
    $('.user-avatar').css('background-image', `url(${this.avatar})`);

    // Complete login
    $('.form-file-button').removeClass('btn-loading disabled');
    if(this.address.length && this.arBalance >= 0) {
      this.loggedIn = true;
      $('#login-modal').modal('hide');
      $('.loggedin').show();
      $('.loggedout').hide();
    }
  }

  private login(e: any) {
    if(e.target && e.target.files) {
      $('.form-file-text').text($(e.target).val().toString().replace(/C:\\fakepath\\/i, ''));
      $('.form-file-button').addClass('btn-loading disabled');

      const fileReader = new FileReader();
      fileReader.onload = async (ev: any) => {
        await this.loadWallet(JSON.parse(fileReader.result.toString()));
        // @ts-ignore
        window.currentPage.syncPageState();
        
        if(this.address.length && this.arBalance >= 0) {
          let isError = false;
          try {
            communityDB.set('sesswall', btoa(fileReader.result.toString()));
          } catch(err) {
            console.log(err);
            isError = true;
          }

          if(isError) {
            try {
              communityDB.clearAll();
              this.login(e);
            } catch(err) {
              console.log(err);
            }
          }
        }
      };
      fileReader.readAsText(e.target.files[0]);
    }
  }

  private events() {
    $('.file-upload-default').on('change', (e: any) => {
      this.login(e);
    });

    $('.logout').on('click', async (e: any) => {
      e.preventDefault();

      $('.loggedin').hide();
      $('.loggedout').show();

      this.loggedIn = false;
      this.wallet = null;
      this.username = '';
      this.avatar = '';
      this.address = '';
      this.arBalance = 0;

      //@ts-ignore
      window.currentPage.syncPageState();
      communityDB.remove('sesswall');

      // Set a dummy wallet address
      this.community.setWallet(await arweave.wallets.generate());
    });
  }
}