const ref = require('../../ref');
const { getCustomerHoldingID, getUserID } = require('../utils');
const config = require('../../config');
const { getAPIClient } = require('../api');
const crypto = require('crypto');
const mailer = require('../../mailer');
const fcm = require('../../fcm');
const utils = require('../utils');

/**
 * handles customer_bank_transfer_completed event from dwolla
 * @param {string} body.resourceId transfer ID
 * @param {string} _links.resource.href customer resource url
 * @returns {Promise}
 */
function customerBankTransferCompletedWebhook(body) {
    const custUrl = body._links.customer.href;
    const customerID = custUrl.substr(custUrl.lastIndexOf('/') + 1);
    const transferID = body.resourceId;
    return getAPIClient().then(client => {
        return getCustomerHoldingID(customerID).then(holdingID => {
            if (!holdingID) {
                throw new Error(`No dwolla holding account for ${customerID}'`);
            }
            return client.get(`${config.dwolla.url}/funding-sources/${holdingID}/balance`).then(res => {
                return getUserID(customerID).then(userID => {
                    const bal = res.body.balance.value;
                    const updates = {};
                    const key = crypto.randomBytes(10).toString('hex');
                    updates[`dwolla/users^bank_transfers/${userID}`] = key;
                    updates[`dwolla/customers^bank_transfers/${customerID}/${transferID}/status`] = 'completed';
                    updates[`dwolla/customers^bank_transfers/${customerID}/${transferID}/updated_at`] = -new Date().valueOf();
                    updates[`dwolla/customers/${customerID}/balance`] = bal;
                    utils.getBankTransfer(customerID, transferID).then(transfer => {
                        console.log('sending email and push notification');
                        const date = transfer.created_at;
                        const src = [];
                        const dest = [];
                        let message = '';
                        if (transfer.type === 'deposit') {
                            src[0] = transfer.bank_name;
                            dest[0] = 'your Travel Fund';
                            message = `Hooray, A transfer for $${transfer.amount} initiated on ${utils.getHumanTime(date)} \
                                from ${src[0]} to ${dest[0]} was completed. For support \
                                please contact tripcents support through the “profile” \
                                screen of your app.`;
                        } else {
                            src[0] = 'your Travel Fund';
                            dest[0] = transfer.bank_name;
                            message = `Ka-Ching! Your withdrawal for $${transfer.amount} initiated on ${utils.getHumanTime(date)} \
                            from ${src[0]} to ${dest[0]} was completed. If you \
                            need anything else, please contact tripcents support through \
                            the profile screen of your app.`;
                        }
                        const bodyDict = {
                            // test: message
                        };

                        mailer
                            .sendTemplateToUser(userID, 'Transfer completed', '196a1c48-5617-4b25-a7bb-8af3863b5fcc', bodyDict, ' ', message)
                            .catch(err => console.error(err));
                        fcm.sendNotificationToUser(userID, 'Transfer completed', 'transfer created').catch(err => console.error(err));
                    });
                    return ref.update(updates);
                });
            });
        });
    });
}

module.exports = customerBankTransferCompletedWebhook;

/**
return Promise.all([getCustomer(customerID), getBankTransfer(customerID, transferID)]).then(resp => {
    const customer = resp[0];
    const transfer = resp[1];

    if (!transfer) {
        return Promise.reject(new APIError(`Transfer ${transferID} not found`, 404));
    }

    if (!customer) {
        return Promise.reject(new APIError(`Customer ${customerID} not found`, 404));
    }
    const updates = {};

    let amount = transfer.amount * 1;
    if (transfer.type === 'withdraw') {
        amount *= -1;
    }
    */
