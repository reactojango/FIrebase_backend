const dwolla = require('dwolla-v2');
const moment = require('moment');
const config = require('../config');
const ref = require('../ref');

const client = new dwolla.Client({
    key: config.dwolla.key,
    secret: config.dwolla.secret,
    environment: config.dwolla.environment
});

export function updateToken() {
    return client.auth.client().then(token => {
        const updates = {
            dwolla_access: {
                token: token.access_token,
                timestamp: new Date().valueOf()
            }
        };
        return ref.update(updates).then(() => token);
    });
}

export function getAPIClient() {
    return ref
        .child('dwolla_access')
        .once('value')
        .then(snap => snap.val())
        .then(dwollaAccess => {
            if (!dwollaAccess) return updateToken();

            const lastFetchTime = moment(dwollaAccess.timestamp, 'x');
            const timeDiff = moment().diff(lastFetchTime, 'seconds');
            if (timeDiff >= 3600) {
                return updateToken();
            }

            return new client.Token({
                access_token: dwollaAccess.token,
                expires_in: timeDiff
            });
        });
}

export default getAPIClient;