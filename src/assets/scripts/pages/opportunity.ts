import { spawn, ModuleThread } from "threads";

import $ from '../libs/jquery';
import { BalancesWorker } from "../workers/balances";
import app from "../app";
import Opportunities from "../models/opportunities";
import Utils from "../utils/utils";
import moment from "moment";
import Opportunity from "../models/opportunity";

export default class PageOpportunity {
  private opportunities: Opportunities;
  private opps: Opportunity[];

  constructor() {
    this.opportunities = new Opportunities();
  }

  async open() {
    $('.page-opportunity').show();
    $('.link-opportunity').addClass('active');
    this.syncPageState();
  }

  async close() {
    $('.link-opportunity').removeClass('active');
    $('.page-opportunity').hide();
  }

  public async syncPageState() {
    this.opps = await this.opportunities.getAllByCommunityIds([app.getCommunityId()]);
    $('.opps-link').attr('href', './opportunity.html');
    await this.toHTML();
  }

  private async toHTML() {
    const opps = this.opps;
    console.log(opps);

    $('[data-total]').text(0);
    $('.bounty-type').find('[data-total="All"]').text(opps.length);

    let html = '';
    for(let i = 0, j = opps.length; i < j; i++) {
      const opp = opps[i];

      const $type = $('.bounty-type').find(`[data-total="${opp.type}"]`);
      $type.text((+$type.text()) + 1);

      const $exp = $('.exp-level').find(`[data-total="${opp.experience}"]`);
      $exp.text((+$exp.text()) + 1);
      const $expTotal = $('.exp-level').find('[data-total="All"]');
      $expTotal.text((+$expTotal.text()) + 1);

      html += `
      <a data-author="${opp.author.address}" data-opp-id="${opp.id}" class="jobs-job list-item" href="./opportunity.html#${opp.id}" target="_blank">
        <span class="avatar"></span>
        <div>
          <span class="text-body d-block">${opp.title}</span>
          <small class="d-block text-muted mt-n1"> 
            <ul class="list-inline list-inline-dots list-md-block mb-0">
              <li class="list-inline-item text-dark">${opp.community.name}</li>
              <li class="list-inline-item">${opp.type}</li>
              <li class="list-inline-item">${opp.experience}</li>
              <li class="list-inline-item">${moment(opp.timestamp).fromNow()}</li>
              <li class="list-inline-item">${opp.applicants.length}&nbsp;${opp.applicants.length === 1? 'applicant': 'applicants'}</li>
            </ul>
          </small>
        </div>
        <span class="list-item-actions text-dark show">${Utils.formatMoney(+opp.payout, 0)}&nbsp;${opp.community.ticker}</span>
      </a>`;
    }

    $('.jobs-list').html(html);

    $('.jobs-job').each((i, el) => {
      const $job = $(el);
      const oppId = $job.attr('data-opp-id');

      this.opportunities.get(oppId).then(async opp => {
        const author = await opp.author.getDetails();
        $job.find('.avatar').attr('style', `background-image: url(${author.avatar})`);
      });
    });

    $('.jobs-list').parents('.dimmer').removeClass('active');
  }

}