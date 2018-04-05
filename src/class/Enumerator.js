'use strict';
var BaseEnumerator = require('../lib/omr-base/class/Enumerator');

class Enumerator extends BaseEnumerator {

    /**
     */
    static get FileResourceType() {
        return {
            DISK: 0,
            DATABASE: 1,
            _regex: /0|1/
        };
    }

    static get ClusterCommand() {
        return {
            GET_AGGREGATION: 0,
            _regex: /0/
        }
    }
}

module.exports = Enumerator;