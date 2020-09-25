import $ from '../libs/jquery';
import Utils from '../utils/utils';
import Toast from '../utils/toast';
import app from '../app';
import Vote from '../models/vote';
import { VoteType, VoteInterface } from 'community-js/lib/faces';

export default class PageVotes {
  private votes: Vote[] = [];
  private firstCall: boolean = true;

  constructor() {
    $('#vote-set-value').on('input', async e => {
      if($('#vote-set-key').val() === 'communityLogo') {
        let setValue: string | number = $('#vote-set-value').val().toString().trim();
        try {
          new URL(setValue);
          $('#vote-set-value-logo-preview').attr('src', setValue);
          $('#vote-set-value-logo-preview').show();
        }
        catch(_) {
          $('#vote-set-value-logo-preview').hide();
        }
      }
    });

    // Disallow spaces
    $('#vote-set-name').on('input', e => {
      let setName: string = $('#vote-set-name').val().toString().replace(' ', '-');
      $('#vote-set-name').val(setName);
    });
  }

  async open() {
    $('.link-votes').addClass('active');
    $('.page-votes').show();
    this.syncPageState();
    this.events();
  }

  async close() {
    for(let i = 0, j = this.votes.length; i < j; i++) {
      this.votes[i].hide();
    }
    this.votes = [];

    await this.removeEvents();
    $('.link-votes').removeClass('active');
    $('.page-votes').hide();
  }

  public async syncPageState() {
    const state = await app.getCommunity().getState();

    $('.min-lock-length').text(state.settings.get('lockMinLength'));
    $('.max-lock-length').text(state.settings.get('lockMaxLength'));

    if(this.firstCall) {
      this.extraParams();
      this.firstCall = false;
    }

    $('.proposals').html('');
    if(state.votes.length) {
      this.votes = [];
      $('.proposals').html('');
      for(let i = 0, j = state.votes.length; i < j; i++) {
        const vote = new Vote(state.votes[i], i);
        this.votes.push(vote);
        await vote.show();
      }
    } else {
      const html = `
      <div class="col-12">
        <div class="card">
          <div class="card-body text-center">
            This Community doesn't have any votes.
          </div>
        </div>
      </div>
      `;
      $('.proposals').html(html);
    }

    $('[data-toggle="tooltip"]').tooltip();
    $('.dimmer').removeClass('active');
  }

  private async extraParams() {
    // Check for hashes to see if we need to open the votes modal.
    const hashes = app.getHashes();
    if(hashes.length > 2 && hashes[2] === 'mint') {
      const addy = hashes[3];
      const qty = hashes[4];
      const lockLength = hashes[5];

      if(addy) {
        $('#vote-recipient').val(addy.trim());
      }
      if(qty) {
        $('#vote-qty').val(qty.trim());
      }
      if(lockLength) {
        $('#vote-lock').val(lockLength.trim());
      }

      $('#modal-new-vote').modal('show');
    }
  }

  private async setValidate() {
    const state = await app.getCommunity().getState();

    const recipient = $('#vote-recipient').val().toString().trim();
    const setKey = $('#vote-set-key').val();
    let setValue: string | number = $('#vote-set-value').val().toString().trim();

    $('.url').each(function() {
      try {
        const url: string = $(this).val().toString().trim();
        new URL(url);
        $(this).removeClass('is-invalid');
      } catch(_) {
        $(this).addClass('is-invalid');
      }
    });
    if($('#vote-set-value').hasClass('url')) {
      console.log("ZZ")
      return false; // we have already validated it
    }

    if(setKey === 'quorum' || setKey === 'support') {
      setValue = +setValue;
      if(isNaN(setValue) || setValue < 1 || setValue > 99 || !Number.isInteger(setValue)) {
        $('#vote-set-value').addClass('is-invalid');
        return false;
      } else {
        $('#vote-set-value').removeClass('is-invalid');
      }
    } else if(setKey === 'lockMinLength' || setKey === 'lockMaxLength') {
      setValue = +setValue;
      if(isNaN(setValue) || setValue < 1 || !Number.isInteger(setValue)) {
        if(setKey === 'lockMinLength') {
          $('.lock-set-value-invalid').text('Minimum lock length cannot be greater nor equal to the maximum lock length.');
          $('#vote-set-value').addClass('is-invalid');
        } else if(setKey === 'lockMaxLength') {
          $('.lock-set-value-invalid').text('Maximum lock length cannot be lower nor equal to the minimum lock length.');
          $('#vote-set-value').addClass('is-invalid');
        }
        return false;
      }
      
      if(setKey === 'lockMinLength' && setValue > state.settings.get('lockMaxLength')) {
        $('.lock-set-value-invalid').text('Minimum lock length cannot be greater nor equal to the maximum lock length.');
        $('#vote-set-value').addClass('is-invalid');
        return false;
      } else if(setKey === 'lockMaxLength' && setValue < state.settings.get('lockMinLength')) {
        $('.lock-set-value-invalid').text('Maximum lock length cannot be lower nor equal to the minimum lock length.');
        $('#vote-set-value').addClass('is-invalid');
        return false;
      }
    } else if(setKey === 'role') {
      if(!Utils.isArTx(recipient)) {
        $('#vote-recipient').addClass('is-invalid');
        return false;
      }
      if(!setValue.length) {
        $('.lock-set-value-invalid').text('Need to type a role.');
        $('#vote-set-value').addClass('is-invalid');
        return false;
      }
    }

    $('#vote-set-value').removeClass('is-invalid');
    return true;
  }

  async validateVotes() {
    $('input[name="voteType"]').on('change', e => {
      const voteType = $('input[name="voteType"]:checked').val();

      switch (voteType) {
        case 'mint':
          $('.vote-recipient, .vote-qty, .vote-lock-length').show();
          $('.vote-fields').hide();
          break;
        case 'burnVault':
          $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields').hide();
          $('.vote-burn-vault').show();
          break;
        case 'set':
          $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields').hide();
          $('.vote-set').show();
          $('#vote-set-key').trigger('change');
          break;
        case 'indicative':
          $('.vote-recipient, .vote-qty, .vote-lock-length, .vote-fields').hide();
          break;
      }
    }).trigger('change');

    function updateOtherIsNumber() {
      if($('#vote-set-value-is-number').is(':checked')) {
        $('#vote-set-value').addClass('input-float');
        $('#vote-set-value').trigger('input');
      } else {
        $('#vote-set-value').removeClass('input-float');
      }
    }

    $('#vote-set-key').on('change', async e => {
      const setKey = $(e.target).val();
      const $target = $('#vote-set-value').val('');

      $('.vote-recipient').hide();
      $('.vote-set-name').hide();
      $('#vote-set-value-is-number-label').hide();
      if(setKey !== 'description') {
        $('#vote-set-value2').hide();
      }
      if(setKey !== 'discussionLinks') {
        $('#vote-set-value').show();
        $('#vote-set-value-links-container').hide();
      }
      if(setKey !== 'communityLogo') {
        $('#vote-set-value-logo-preview').hide();
      }
      $('#vote-set-value').removeClass('input-number input-float percent url');
      switch(setKey) {
        case 'role':
          $('.vote-recipient').show();
          break;
        case 'lockMinLength':
        case 'lockMaxLength':
          $target.addClass('input-number');
          break;
        case 'quorum':
        case 'support':
          $target.addClass('input-number percent');
          break;
        case 'description':
          $('#vote-set-value').hide();
          $('#vote-set-value2').show();
          break;
        case 'appUrl':
          $target.addClass('url');
          break;
        case 'communityLogo':
          $target.addClass('url');
          break;
        case 'discussionLinks':
          $('#vote-set-value').hide();
          $('#vote-set-value-links-container').show();
          break;
        case 'other':
          updateOtherIsNumber();
          $('.vote-set-name').show();
          $('#vote-set-value-is-number-label').show();
          break;
      }

      await this.setValidate();
    });

    $('#vote-set-value-is-number').on('click', e => {
      updateOtherIsNumber();
    });

    function updateUpDownArrows() {
      // Now we have only one table with arrows, so it's efficient enough. If we add more tables, probably should restrict to one table at a time.
      $('.move-up-tr').each(function () {
        $(this).css('visibility', $(this).closest('tr').is(':nth-child(2)') ? 'hidden' : 'visible');
      });
      $('.move-down-tr').each(function () {
        $(this).css('visibility', $(this).closest('tr').is(':last-child') ? 'hidden' : 'visible');
      });
    }

    $('.delete-tr').on('click', e => {
      $(e.target).closest('tr').remove();
      updateUpDownArrows();
    });

    $('.move-up-tr').on('click', e => {
      const row = $(e.target).closest('tr');
      row.prev().before(row);
      updateUpDownArrows();
    });

    $('.move-down-tr').on('click', e => {
      const row = $(e.target).closest('tr');
      row.next().after(row);
      updateUpDownArrows();
    });

    $('#vote-set-value-links-add').on('click', e => {
      const copy = $('#vote-set-value-links-template').clone(true);
      copy.css('display', 'block');
      $('#vote-set-value-links-template').after(copy);
      updateUpDownArrows();
    });

    $('#vote-recipient, #vote-target').on('input', async e => {
      const $target = $(e.target);
      const value = $target.val().toString().trim();
      if(!await Utils.isArTx(value)) {
        $target.addClass('is-invalid');
      } else {
        $target.removeClass('is-invalid');
      }
    });

    $('.btn-max-lock').on('click', async e => {
      e.preventDefault();

      const state = await app.getCommunity().getState();
      $('.input-max-lock').val(state.settings.get('lockMaxLength'));
    });

    $('#vote-set-value').on('input', async e => {
      await this.setValidate();
    });

    $('#vote-qty').on('input', async e => {
      const qty = +$('#vote-qty').val().toString().trim();

      if(qty < 1 || !Number.isInteger(qty)) {
        $('#vote-qty').addClass('is-invalid');
      } else {
        $('#vote-qty').removeClass('is-invalid');
      }
    });

    $('#vote-lock-length').on('input', async e => {
      const length = +$('#vote-lock-length').val().toString().trim();
      const state = await app.getCommunity().getState();

      if(isNaN(length) ||
         !Number.isInteger(length) ||
         (length < state.settings.get('lockMinLength') || length > state.settings.get('lockMaxLength')) && length != 0) {
        $('#vote-lock-length').addClass('is-invalid');
      } else {
        $('#vote-lock-length').removeClass('is-invalid');
      }
    });

    $('#vote-target').on('input', async e => {
      const target = $('#vote-target').val().toString().trim();
      if(!await Utils.isArTx(target)) {
        $('#vote-target').addClass('is-invalid');
      } else {
        $('#vote-target').removeClass('is-invalid');
      }
    });

    $('#vote-note').on('input', e => {
      const note = $('#vote-note').val().toString().trim();
      if(!note.length) {
        $('#vote-note').addClass('is-invalid');
      } else {
        $('#vote-note').removeClass('is-invalid');
      }
    });

    $('.do-vote').on('click', async e => {
      e.preventDefault();
      const state = await app.getCommunity().getState();

      // @ts-ignore
      const voteType: VoteType = $('input[name="voteType"]:checked').val().toString();
      const recipient = $('#vote-recipient').val().toString().trim();
      const qty = +$('#vote-qty').val().toString().trim();
      const length = +$('#vote-lock-length').val().toString().trim();
      const target = $('#vote-target').val().toString().trim();
      const setKey = $('#vote-set-key').val();
      let setValue = $('#vote-set-value2').css('display') !== 'none'
        ? $('#vote-set-value2').text().trim()
        : $('#vote-set-value').val().toString().trim();
      const note = $('#vote-note').val().toString().trim();

      let voteParams: VoteInterface = {
        type: voteType
      };

      if(voteType === 'mint') {
        if(!await Utils.isArTx(recipient)) {
          $('#vote-recipient').addClass('is-invalid');
          return;
        }
        if(qty < 1 || !Number.isInteger(qty)) {
          $('#vote-qty').addClass('is-invalid');
          return;
        }

        voteParams['recipient'] = recipient;
        voteParams['qty'] = qty;

        // If a lock length was specified, mint locked tokens.
        if(length > 0) {
          if(isNaN(length) || !Number.isInteger(length) || length < state.settings.get('lockMinLength') || length > state.settings.get('lockMaxLength')) {
            $('#vote-lock-length').addClass('is-invalid');
            return;
          }
          voteParams['type'] = 'mintLocked';
          voteParams['lockLength'] = length;
        }
      } else if(voteType === 'burnVault') {
        if(!await Utils.isArTx(target)) {
          $('#vote-target').addClass('is-invalid');
          return;
        }
        voteParams['target'] = target;
      } else if(voteType === 'set') {
        if(!await this.setValidate()) {
          return;
        }
        
        // @ts-ignore
        voteParams['key'] = setKey === 'other' ? $('#vote-set-name').val().toString() : setKey;
        voteParams['value'] = setValue;
      }

      if(!note.length) {
        $('#vote-note').addClass('is-invalid');
        return;
      }
      voteParams['note'] = note;

      // All validations passed
      $(e.target).addClass('btn-loading disabled');
      try {
        const txid = await app.getCommunity().proposeVote(voteParams);
        app.getStatusify().add('Create vote', txid)
        .then(async () => {
          // Just create the new vote, do not sync the entire page.
          const state = await app.getCommunity().getState(false);

          const voteId = state.votes.length - 1;
          if(this.votes.length < state.votes.length) {
            const vote = new Vote(state.votes[this.votes.length], this.votes.length);
            this.votes.push(vote);
            await vote.show();
          }
        });
      } catch (err) {
        console.log(err.message);
        const toast = new Toast();
        toast.show('Vote error', err.message, 'error', 3000);
      }

      $('#modal-new-vote').modal('hide');
      $(e.target).removeClass('btn-loading disabled');
    });
  }
  async removeValidateVotes() {
    $('input[name="voteType"], #vote-set-key').off('change');
    $('#vote-recipient, #vote-target, #vote-set-value').off('input');
    $('.btn-max-lock, .do-vote').off('click');
  }

  private async events() {
    await this.validateVotes();
  }
  private async removeEvents() {
   await this.removeValidateVotes();
  }
}