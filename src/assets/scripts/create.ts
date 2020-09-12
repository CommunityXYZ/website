import "../styles/style.scss";

import Community from 'community-js';
import $ from './libs/jquery';
import "bootstrap/dist/js/bootstrap.bundle";

import './global';
import { JWKInterface } from "arweave/web/lib/wallet";
import Utils from "./utils/utils";

let arweave = Utils.createArweaveInstance();
const community = new Community(arweave);

let currentStep = 1;
let wallet: JWKInterface;
const create = {
  address: '',
  balance: 0,
  communityName: '',
  ticker: '',
  balances: {},
  support: 0,
  quorum: 0,
  voteLength: 0,
  lockMinLength: 0,
  lockMaxLength: 0
}

const createCommunity = () => {
  community.create().then(communityTx => {
    $('.mining-btn').attr('href', `./#${communityTx}`);

    const attempt = async () => {
      const res = await arweave.transactions.getStatus(communityTx);
      if (res.status !== 200 && res.status !== 202) {
        $('.mining-btn').removeClass('btn-primary').addClass('btn-danger').addClass('disabled').text('Transaction Rejected');
      }

      if(res.confirmed) {
        // TODO: Show confirmed transaction
        $('.mining-btn').text(`DONE! VISIT YOUR COMMUNITY`).removeClass('disabled');
        return;
      }

      setTimeout(() => attempt(), 30000);
    };
    attempt();
  }).catch(e => {
    console.log(e);
  });
}

const allowContinue = () => {
  $('.continue').text(currentStep === 4? 'Launch Community' : 'Continue');
  $('.continue').prop('disabled', false);
}

const validate = async (e: any) => {
  if(currentStep === 1) {
    if($('.form-file-button').text() !== 'Browse') return;

    if(e.target && e.target.files) {
      $('.form-file-text').text($(e.target).val().toString().replace(/C:\\fakepath\\/i, ''));
      $('.form-file-button').addClass('btn-loading disabled');

      const fileReader = new FileReader();
      fileReader.onload = async (ev: any) => {
        wallet = JSON.parse(ev.target.result);
        create.address = await community.setWallet(wallet);
        create.balance = +arweave.ar.winstonToAr((await arweave.wallets.getBalance(create.address)), { formatted: true, decimals: 5, trim: true });

        $('.addy').text(create.address);
        $('.bal').text(create.balance);

        $('.form-file-button').removeClass('btn-loading disabled');
        allowContinue();
      };
      fileReader.readAsText(e.target.files[0]);
    } else if(wallet && create.address && create.balance) {
      allowContinue();
    }

  } else if(currentStep === 2) {
    create.communityName = $('#communityname').val().toString().trim();
    create.ticker = $('#psttoken').val().toString().trim().toUpperCase();

    $('.communityname').text(create.communityName);
    $('.ticker').text(create.ticker);

    const $holders = $('.holder');
    const $holdersBalance = $('.holder-balance');
    
    create.balances = {};
    for(let i = 0, j = $holders.length; i < j; i++) {
      const $holder = $($holders[i]);
      const holder = $holder.val().toString().trim();
      const bal = +$($holdersBalance[i]).val().toString().trim();

      
      if(!/^[a-z0-9-_]{43}$/i.test(holder)) {
        $holder.addClass('border-danger');
        continue;
      } else {
        $holder.removeClass('border-danger');
      }

      if(holder.length && bal && !isNaN(bal) && Number.isInteger(bal)) {
        create.balances[holder] = bal;
      }
    }

    if(create.communityName.length && create.ticker.length && Object.keys(create.balances).length) {
      // add each holders and their balances
      let html = '';
      let i = 0;
      for(let acc in create.balances) {
        html += `<tr>
          <td data-label="Wallet #${++i}">${acc}</td>
          <td data-label="Balance">${create.balances[acc]}</td>
        </tr>`;
      }
      $('.show-holders').find('tbody').html(html);

      allowContinue();
    }
  } else if(currentStep === 3) {
    const support = +$('#support').val().toString().trim();
    const quorum = +$('#quorum').val().toString().trim();
    const voteLength = +$('#voteLength').val().toString().trim();
    const lockMinLength = +$('#lockMinLength').val().toString().trim();
    const lockMaxLength = +$('#lockMaxLength').val().toString().trim();

    if(!isNaN(support) && Number.isInteger(support) && support < 100) {
      create.support = support;
    }
    if(!isNaN(quorum) && Number.isInteger(quorum) && quorum < 100) {
      create.quorum = quorum;
    }
    if(!isNaN(voteLength) && Number.isInteger(voteLength)) {
      create.voteLength = voteLength;
    }
    if(!isNaN(lockMinLength) && Number.isInteger(lockMinLength)) {
      create.lockMinLength = lockMinLength;
    }
    if(!isNaN(lockMaxLength) && Number.isInteger(lockMaxLength)) {
      create.lockMaxLength = lockMaxLength;
    }

    if(create.support && create.quorum && create.voteLength && create.lockMinLength && create.lockMaxLength) {
      $('.support').text(create.support);
      $('.quorum').text(create.quorum);
      $('.voteLength').text(create.voteLength);
      $('.lockMinLength').text(create.lockMinLength);
      $('.lockMaxLength').text(create.lockMaxLength);

      allowContinue();
    }
  } else if(currentStep === 4) {
    await community.setState(create.communityName, create.ticker, create.balances, create.quorum, create.support, create.voteLength, create.lockMinLength, create.lockMaxLength);
    const cost = await community.getCreateCost();
    const ar = +arweave.ar.winstonToAr(cost, {formatted: true, decimals: 5, trim: true});
    $('.cost').text(ar);
    if(create.balance < ar) {
      $('.continue').removeClass('btn-primary').addClass('btn-danger').text('Not enough balance');
      return;
    }

    const checked = $('#confirm').prop("checked") && $('#aknowledge').prop("checked");
    if(checked) {
      $('#confirm, #aknowledge').prop('disabled', true);
      allowContinue();
    }
  }
};

$(document).ready(() => {
  $('[data-toggle="tooltip"]').tooltip();

  $('.back').on('click', (e: any) => {
    e.preventDefault();
    $(e.target).blur();

    if(!$(e.target).is('disabled') && currentStep > 1) {
      $(`.step${currentStep}`).fadeOut(() => {
        $(`.step${--currentStep}`).fadeIn();

        if(currentStep === 1) {
          $(e.target).addClass('disabled');
        } else {
          $(e.target).removeClass('disabled');
        }

        $('.continue').text(currentStep === 4? 'Launch Community' : 'Continue');
        $('.continue').removeClass('btn-danger').addClass('btn-primary').prop('disabled', true);
        validate(e);
      });
    }
  });

  $('.continue').on('click', async (e: any) => {
    e.preventDefault();
    $(e.target).blur();

    if($(e.target).is('.btn-primary')) {
      currentStep++;

      if(currentStep === 5) {
        $('.create-steps').fadeOut(() => {
          $('.mining').fadeIn();
          createCommunity();
        });

        return;
      }

      $(`.step${(currentStep-1)}`).fadeOut(() => {
        $(`.step${currentStep}`).fadeIn();

        $(e.target).prop('disabled', true);
        $('.back').removeClass('disabled');

        validate(e);
      });
    }
  });

  $('.file-upload-browse').on('click', (e: any) => {
    e.preventDefault();

    var file = $('.file-upload-default');
    file.trigger('click');
  });
  
  $(document).on('change', 'input', (e: any) => {
    validate(e);
  }).on('keyup', (e: any) => {
    validate(e);
  });

  $('.add-holders').on('click', (e: any) => {
    e.preventDefault();

    $('.holders').find('tbody').append(`<tr>
      <td data-label="Wallet address">
        <input class="holder form-control" type="text">
      </td>
      <td data-label="Balance">
        <div class="input-group">  
          <input class="holder-balance input-number form-control" type="text" value="0">
          <span class="input-group-text ticker">${create.ticker}</span>
        </div>
      </td>
    </tr>`);
  
  });
  $(document).on('input', '.input-number', (e: any) => {
    const $target = $(e.target);
    const newVal = +$target.val().toString().replace(/[^0-9]/g, '');
    $target.val(newVal);

    if($target.hasClass('percent') && newVal > 99) {
      $target.val(99);
    }
  });
});