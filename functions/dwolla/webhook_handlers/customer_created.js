const ref = require('../../ref');
const mailer = require('../../mailer');
// const fcm = require('../../fcm');
const utils = require('../utils');
const { getCustomer } = require('../utils');

/**
 * handles customer_created event from dwolla
 * @param {string} body.resourceId
 * @returns {Promise}
 */
// customer is being added as verified because in the sandbox
// the verification webhooks sometimes come before created
function customerCreatedWebhook(body) {
    const customerID = body.resourceId;
    return getCustomer(customerID).then(customer_info => {
        let status = '';
        if (customer_info.status === 'pending') {
            status = 'created';
        } else {
            status = customer_info.status;
        }
        const updates = {};
        updates[`dwolla/customers/${customerID}/status`] = status;
        updates[`dwolla/customers/${customerID}/balance`] = 0;
        utils.getUserID(customerID).then(userID => {
            console.log('sending email and push notification');
            // fcm.sendNotificationToUser(userID, 'Tripents Savings Created!', 'Your dwolla account has been created!').catch(err => console.error(err));
            const message =
                'Congratulations! You’ve successfully opened a travel fund. \
                You’re one step closer to that dream trip you’ve always kept on \
                the backburners, so give yourself a pat on the back. This email \
                also confirms that you accept our partner Dwolla’s \
                Terms of Service and Privacy Policy. Thanks! -The Tripcents team';
            const bodyDict = {};
            mailer
                .sendTemplateToUser(userID, 'Customer account created', '196a1c48-5617-4b25-a7bb-8af3863b5fcc', bodyDict, ' ', message)
                .catch(err => console.error(err));
        });
        return ref.update(updates);
    });
}

module.exports = customerCreatedWebhook;
