const ref = require('../../ref');
const { getAPIClient } = require('../api');
const config = require('../../config');
const { getCustomerHoldingID } = require('../utils');

/**
 * handles customer_activated event from dwolla
 * @param {string} userID
 * @param {Object} transferData
 * @returns {Promise<string>} promise of customerID added
 */
function makeDwollaTransfer(userID, transferData) {
    return getAPIClient()
        .then(client => {
            return getCustomerHoldingID(transferData.customer_id).then(holdingID => {
                const requestBody = {
                    _links: {
                        source: {
                            href: `${config.dwolla.url}/funding-sources/${transferData.fund}`
                        },
                        destination: {
                            href: `${config.dwolla.url}/funding-sources/${holdingID}`
                        }
                    },
                    amount: {
                        currency: 'USD',
                        value: transferData.amount
                    }
                };
                return client.post('transfers', requestBody).then(res => {
                    const transferUrl = res.headers.get('location');
                    const transferId = transferUrl.substr(transferUrl.lastIndexOf('/') + 1);
                    return transferId;
                });
            });
        })
        .then(transfer => {
            const updates = {};
            updates[`dwolla/users^bank_transfers/${userID}`] = transfer;
            return ref.update(updates).then(() => {
                console.log(`bank name is ${transferData.bank_name}`);

                return ref
                    .child('dwolla')
                    .child('customers^bank_transfers')
                    .child(transferData.customer_id)
                    .child(transfer)
                    .set({
                        amount: transferData.amount,
                        status: 'pending',
                        type: 'deposit',
                        created_at: -new Date().valueOf(),
                        updated_at: -new Date().valueOf(),
                        bank_name: transferData.bank_name,
                        account_name: transferData.account_name,
                        transfer_type: 'one-time'
                    })
                    .then(() => transfer);
            });
        });
}

module.exports = makeDwollaTransfer;
