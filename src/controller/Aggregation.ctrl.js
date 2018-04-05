'use strict';
const CPUCount = require('os').cpus().length;
const Enumerator = require('../class/Enumerator');
const Config = require('../config/Config');
const AggregationBO = require('../lib/omr-base/business/Aggregation.bo');;
const ExamBO = require('../lib/omr-base/business/Exam.bo');

const aggregation = new AggregationBO();

class AggregationController {


    /**
     * Get exam count
     * @return {Number}
     */
    static get examCount() {
        return AggregationController._examCount;
    };

    /**
     * Set exam count
     * @param value {Number}
     */
    static set examCount(value) {
        AggregationController._examCount = value;
    }

    /**
     * Get next free aggregation
     * @param callback {Function}
     */
    static getNext(callback) {
        AggregationController.examCount = 0;

        aggregation.GetCount({
            processStatus: Enumerator.ProcessStatus.PROCESSING
        }, (error, count) => {
            var where = {};
            if (error) return callback(error);

            if (count >= CPUCount) return callback();

            if (Config.DeveloperDebug) {
                count = null;
                where = {};
            } else {
                where = {
                    processStatus: Enumerator.ProcessStatus.PENDING
                };
            }

            aggregation.GetByQuery(
                where,
                '_template externalId processStatus exam hasQueue',
                1,
                '+alterationDate',
                (error, data) => {
                    if (error) return callback(error);
                    if (data.length == 0) return callback();

                    data[0].processStatus = Enumerator.ProcessStatus.PROCESSING;
                    AggregationController.data = data[0];

                    aggregation.Update(data[0]._id, data[0], (err) => {
                        if (err) return callback(err);
                        return callback(null, data[0]);
                    });
                },
                null, null, '_template.ref', null, undefined, true
            );
        })
    }

    /**
     * Get exam list for the current aggregation
     * @param callback {Function}
     */
    static getExamList(callback) {
        const exam = new ExamBO();
        var where = {
            _aggregation: AggregationController.data._id,
            processStatus: Enumerator.ProcessStatus.PENDING
        };

        if (Config.DeveloperDebug) {
            where.processStatus = {
                $in: [
                    Enumerator.ProcessStatus.PENDING,
                    Enumerator.ProcessStatus.WARNING,
                    Enumerator.ProcessStatus.SUCCESS
                ]
            };
        }

        exam.GetByQuery(
            where,
            '_aggregation externalId owner processStatus fileExtension',
            null, null, (error, examList) => {
                if (error) return callback(error);

                AggregationController.examCount = examList.length;

                callback(null, examList);
            }, null, null, null, null, undefined, true
        );
    }

    /**
     * Get aggregation exams with processStatus = SUCCESS, ERROR or WARNING
     * @param callback
     */
    static getExamsDone(callback) {
        const exam = new ExamBO();
        var where = {
            processStatus: {$in: [
                Enumerator.ProcessStatus.SUCCESS,
                Enumerator.ProcessStatus.ERROR,
                Enumerator.ProcessStatus.WARNING
            ]}
        };

        exam.GetByQuery(
            where,
            'processStatus fileExtension',
            null, null, (error, examList) => {
                if (error) return callback(error);

                callback(null, examList);
            }, null, null, null, null, undefined, true
        );
    }

    /**
     * Get aggregation by current id
     * @param callback {Function}
     * @param parentField {String=}
     * @param parentValue {String=}
     * @param populateRefs {String=}
     * @param populateFields {String=}
     * @param lean {Boolean=}
     */
    static getById(callback, parentField, parentValue, populateRefs, populateFields, lean) {
        aggregation.GetById(AggregationController.data._id, callback, parentField, parentValue, populateRefs, populateFields, lean);
    }

    /**
     * Update current aggregation
     * @param data {Object}
     * @param callback {Function}
     */
    static update (data, callback) {
        aggregation.Update(AggregationController.data._id, data, callback);
    }
}

module.exports = AggregationController;