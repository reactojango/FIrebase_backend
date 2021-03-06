const ref = require('../../ref');
const { getAPIClient } = require('../api');
const { getPlaidClient } = require('../api');
const config = require('../../config');
const { getCustomerID } = require('../utils');

// @TODO define customerData granually
/**
 * handles customer_activated event from dwolla
 * @param {string} userID
 * @param {Object} fundData
 * @returns {Promise<string>} promise of customerID added
 */
function linkFundingSource(userID, fundData) {
    const acctId = fundData.metaData.account_id;
    return getCustomerID(userID)
        .then(customerID => {
            const plaid_client = getPlaidClient();
            return plaid_client.exchangePublicToken(fundData.publicToken).then(plaid_res1 => {
                const access_token = plaid_res1.access_token;
                return plaid_client.createProcessorToken(access_token, acctId, 'dwolla').then(plaid_res2 => {
                    return [plaid_res2.processor_token, customerID, access_token];
                });
            });
        })
        .then(dwolla_info => {
            return getAPIClient().then(dwolla_client => {
                const customerId = dwolla_info[1];
                const customerUrl = `${config.dwolla.url}/customers/${customerId}/funding-sources`;
                const requestBody = {
                    plaidToken: dwolla_info[0],
                    name: fundData.metaData.account.name
                };
                return dwolla_client.post(customerUrl, requestBody).then(dwolla_res => {
                    return [dwolla_res.headers.get('location'), customerId, dwolla_info[2]];
                });
            });
        })
        .then(fundInfo => {
            const fundId = fundInfo[0].substr(fundInfo[0].lastIndexOf('/') + 1);
            return ref
                .child('dwolla')
                .child('customers^funding_source')
                .child(fundInfo[1])
                .child(fundId)
                .set({
                    status: 'pending',
                    bank_name: fundData.metaData.institution.name,
                    ins_id: fundData.metaData.institution.institution_id,
                    name: fundData.metaData.account.name,
                    plaid_account_id: acctId,
                    plaid_access_token: fundInfo[2]
                })
                .then(() => fundId);
        });
}

module.exports = linkFundingSource;
