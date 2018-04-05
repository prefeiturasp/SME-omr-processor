'use strict';
const fs = require('fs');
const path = require('path');
const async = require('async');
const Config = require('./config/Config');
Config.init();
const Enumerator = require('./class/Enumerator');
const Aggregation = require('./controller/Aggregation.ctrl');
const Exam = require('./controller/Exam.ctrl');
const mongo = require('./lib/omr-base/class/Database')(Config.MongoDB);
var Connector;

require('./lib/omr-base/class/Log')({
    db: mongo.db,
    connectionString: Config.MongoDB,
    label: Enumerator.LogType.PROCESSOR,
    level: Config.KeepLogLevel
});

Connector = require('./lib/omr-base/connector/ConnectorManager')(Config, Enumerator);

process.on('uncaughtException', (error) => {
    logger.error(error.message, {
        resource: {
            process: "UncaughtException"
        },
        detail: {
            description: error
        }
    }, () => {
        if (Aggregation.data && Aggregation.data.hasOwnProperty('processStatus')) {
            if (Aggregation.examCount > 0) Aggregation.data.processStatus = Enumerator.ProcessStatus.PENDING;
            else Aggregation.data.processStatus = Enumerator.ProcessStatus.FINISHED;
            updateAggregation(false, 1);
        } else {
            process.exit(1);
        }
    });
});

process.on('unhandledRejection', (error, p) => {
    logger.error(error.message, {
        resource: {
            process: "UnhandledRejection"
        },
        detail: {
            description: error
        }
    }, () => {
        if (Aggregation.data && Aggregation.data.hasOwnProperty('processStatus')) {
            if (Aggregation.examCount > 0) Aggregation.data.processStatus = Enumerator.ProcessStatus.PENDING;
            else Aggregation.data.processStatus = Enumerator.ProcessStatus.FINISHED;
            updateAggregation(false, 1);
        } else {
            process.exit(1);
        }
    });
});

process.on('SIGTERM', () => {
    logger.warn('SIGTERM', {
        resource: {
            process: "SIGTERM",
            params: []
        },
        detail: {
            description: 'Service terminated with SIGTERM signal'
        }
    }, () => {
        if (Aggregation.data && Aggregation.data.hasOwnProperty('processStatus')) {
            if (Aggregation.examCount > 0) Aggregation.data.processStatus = Enumerator.ProcessStatus.PENDING;
            else Aggregation.data.processStatus = Enumerator.ProcessStatus.FINISHED;
            updateAggregation(false, 0);
        } else {
            process.exit(0);
        }
    });
});

process.on('SIGINT' , () => {
    logger.warn('SIGINT', {
        resource: {
            process: "SIGINT",
            params: []
        },
        detail: {
            description: 'Service terminated with SIGINT signal'
        }
    }, () => {
        if (Aggregation.data && Aggregation.data.hasOwnProperty('processStatus')) {
            if (Aggregation.examCount > 0) Aggregation.data.processStatus = Enumerator.ProcessStatus.PENDING;
            else Aggregation.data.processStatus = Enumerator.ProcessStatus.FINISHED;
            updateAggregation(false, 0);
        } else {
            process.exit(0);
        }
    });
});

/**
 * Run processor service
 */
function run() {
    logger.info('Started', {
        resource: {
            process: "Processor.run",
        }
    });

    Aggregation.getNext((error, data) => {
        if (error) {
            logger.error(error.message, {
                resource: {
                    process: "AggregationController.GetNext"
                },
                detail: {
                    description: error
                }
            }, () => {
                process.exit(1);
            });
        } else if (!data) {
            logger.info('Finished', {
                resource: {
                    process: "Processor.run",
                }
            }, () => {
                process.exit(0);
            });
        } else {
            Aggregation.getExamList((error, examList) => {
                if (error) {
                    logger.error(error.message, {
                        resource: {
                            process: "Aggregation.getExamList"
                        },
                        detail: {
                            description: error
                        }
                    }, () => {
                        process.exit(1);
                    });
                } else if (!examList.length) {
                    Aggregation.data.processStatus = Enumerator.ProcessStatus.PENDING;
                    updateAggregation(false);
                } else {
                    examProcessor(examList);
                }
            })
        }
    })
}

/**
 * Exam processor recursive
 * @param examList {Array} Exam document list
 */
function examProcessor(examList) {
    var currentExam = examList.pop();
    var exam = new Exam(Aggregation.data._template.ref, currentExam);

    Aggregation.examCount = examList.length;

    exam.startProcessing((err, res) => {
        setExamLog(err, res, currentExam)
            .then((result) => {
                let queue = [];
                if (Array.isArray(result.error) && result.error.length) {
                    Aggregation.data.exam.error += result.error.length;
                    queue.push(Connector.SendExamLog(result.error));
                }
                if (Array.isArray(result.warning) && result.warning.length) {
                    Aggregation.data.exam.warning += result.warning.length;
                    queue.push(Connector.SendExamLog(result.warning));
                }
                if (Array.isArray(result.success) && result.success.length) {
                    Aggregation.data.exam.success += result.success.length;
                    queue.push(Connector.SendExamLog(result.success));
                }

                Promise.all(queue)
                    .then(() => {
                        if (examList.length) examProcessor(examList);
                        else {
                            cleanUp()
                                .then(finishProcessing, finishProcessing);
                        }
                    })
                    .catch(() => {
                        if (examList.length) examProcessor(examList);
                        else {
                            cleanUp()
                                .then(finishProcessing, finishProcessing);
                        }
                    });
            });
    })
}

/**
 * Finish aggregation process
 */
function finishProcessing() {
    Aggregation.data.processStatus = Enumerator.ProcessStatus.FINISHED;
    Connector.SendAggregationLog({
        aggregationExternalId: Aggregation.data.externalId,
        aggregationId: Aggregation.data._id,
        description: {message: 'Process Finished'}
    }, Aggregation.data.processStatus)
        .then(() => {
            updateAggregation(false, 0);
        });
}

/**
 * Set exam log
 * @param error {Error} Exam error
 * @param result {Object} Exam result
 * @param exam {Object} Exam model reference
 * @return {Promise}
 */
function setExamLog(error, result, exam) {
    let ret = {};
    let queue = [];

    exam = result.Exam || exam;
    if (error) {
        ret.error = [];
        ret.error.push(
            {
                level: Enumerator.LogLevel.ERROR,
                examId: exam._id.toString(),
                examOwner: exam.owner,
                externalId: exam.externalId,
                processStatus: exam.processStatus,
                description: error.message,
                aggregationId: Aggregation.data._id,
                aggregationExternalId: Aggregation.data.externalId
            }
        );

        queue.push(
            new Promise((resolve) => {
                logger.error(error.message, {
                    resource: {
                        process: 'ExamController.startProcessing',
                        params: [exam._id]
                    },
                    detail: {
                        description: error,
                        image: exam._id.toString(),
                        user: exam.owner
                    }
                }, () => {
                    resolve();
                });
            })
        );
    } else if (result.hasOwnProperty('ErrorList') && Array.isArray(result.ErrorList) && result.ErrorList.length > 0) {
        ret.error = [];
        result.ErrorList.forEach((error) => {
            ret.error.push(
                {
                    level: Enumerator.LogLevel.ERROR,
                    examId: exam._id.toString(),
                    examOwner: exam.owner,
                    externalId: exam.externalId,
                    processStatus: exam.processStatus,
                    description: error.hasOwnProperty('Description') && error.Description instanceof Error?
                        error.Description.message: error.message,
                    aggregationId: Aggregation.data._id,
                    aggregationExternalId: Aggregation.data.externalId
                }
            );

            queue.push(
                new Promise((resolve) => {
                    logger.error(error.hasOwnProperty('Description') && error.Description instanceof Error?
                        error.Description.message: error.message, {
                        resource: {
                            process: error.Process || '',
                            params: [exam._id]
                        },
                        detail: {
                            description: error.Description || error,
                            image: exam._id.toString(),
                            user: exam.owner
                        }
                    }, () => {
                        resolve();
                    });
                })
            );
        });
    } else if (exam.processStatus == Enumerator.ProcessStatus.WARNING) {
        ret.warning = [];
        ret.warning.push(
            {
                level: Enumerator.LogLevel.WARNING,
                examId: exam._id.toString(),
                examOwner: exam.owner,
                externalId: exam.externalId,
                processStatus: exam.processStatus,
                description: 'Null or Erased Answers',
                aggregationId: Aggregation.data._id,
                aggregationExternalId: Aggregation.data.externalId
            }
        );

        queue.push(
            new Promise((resolve) => {
                logger.warn('Exam inconsistency', {
                    resource: {
                        process: 'Processor.CheckResult',
                        params: [exam._id]
                    },
                    detail: {
                        description: 'Null or Erased Answers',
                        image: exam._id.toString(),
                        user: exam.owner
                    }
                }, () => {
                    resolve();
                });
            })
        );
    } else if (exam.processStatus == Enumerator.ProcessStatus.SUCCESS) {
        ret.success = [];
        ret.success.push(
            {
                level: Enumerator.LogLevel.INFORMATION,
                examId: exam._id.toString(),
                examOwner: exam.owner,
                externalId: exam.externalId,
                processStatus: exam.processStatus,
                description: 'Corrected Successfully',
                aggregationId: Aggregation.data._id,
                aggregationExternalId: Aggregation.data.externalId
            }
        );

        queue.push(
            new Promise((resolve) => {
                logger.info('Exam corrected', {
                    resource: {
                        process: 'Processor.CheckResult',
                        params: [exam._id]
                    },
                    detail: {
                        description: 'Success',
                        image: exam._id.toString(),
                        user: exam.owner
                    }
                }, () => {
                    resolve();
                });
            })
        );
    }

    return new Promise((resolve) => {
        Promise.all(queue)
            .then(() => {
                resolve(ret);
            })
            .catch(() => {
                resolve(ret);
            })
    });
}

/**
 *
 * @param keepRunning {Boolean=}
 * @param exitCode {Number=}
 */
function updateAggregation(keepRunning, exitCode) {
    exitCode = exitCode || 0;

    if (!keepRunning) {
        logger.info('Finished', {
            resource: {
                process: "Processor.updateAggregation",
            }
        });
    }

    Aggregation.getById((error, ag) => {
        if (error) {
            logger.error(error.message, {
                resource: {
                    process: 'AggregationController.getById',
                    params: [Aggregation.data._id]
                },
                detail: {
                    description: error
                }
            }, () => {
                if (!keepRunning) process.exit(1);
            });
        } else {
            Aggregation.data.hasQueue = ag.hasQueue;
            if (ag.hasQueue && Aggregation.data.processStatus === Enumerator.ProcessStatus.FINISHED) {
                Aggregation.data.processStatus = Enumerator.ProcessStatus.RAW;
                Aggregation.data.hasQueue = false;
            }

            Aggregation.update(Aggregation.data, (error) => {
                if (error) {
                    logger.error(error.message, {
                        resource: {
                            process: 'AggregationController.update',
                            params: [Aggregation.data._id]
                        },
                        detail: {
                            description: error
                        }
                    }, () => {
                        if (!keepRunning) process.exit(1);
                    });
                } else {
                    if (!keepRunning) process.exit(exitCode);
                }
            })
        }
    },
    null, null, null, null, true)
}

/**
 * Remove unused files from disk
 */
function cleanUp() {
    return new Promise((resolve) => {
        Aggregation.getExamsDone(
            (error, exams) => {
                if (error) {
                    logger.error(error.message, {
                        resource: {
                            process: 'AggregationController.getExamsDone',
                            params: [Aggregation.data._id]
                        },
                        detail: {
                            description: error
                        }
                    }, () => {
                        resolve();
                    });
                }
                else {
                    let queue = exams.map((exam) => {
                        if (exam.processStatus === Enumerator.ProcessStatus.SUCCESS ||
                            exam.processStatus === Enumerator.ProcessStatus.ERROR ||
                            exam.processStatus === Enumerator.ProcessStatus.WARNING)
                            return (_c) => {
                                removeFile(Config.FileResource.DIRECTORY.ORIGINAL, exam._id, exam.fileExtension, _c)
                            };
                        if (exam.processStatus === Enumerator.ProcessStatus.SUCCESS) {
                            return (_c) => {
                                removeFile(Config.FileResource.DIRECTORY.EQUALIZED, exam._id, Enumerator.FileExtensions.PNG, _c);
                            };
                        }
                    });

                    async.parallelLimit(queue, 100, (error) => {
                        if (error) {
                            logger.error(error.message, {
                                resource: {
                                    process: 'Processor.cleanUp',
                                    params: [Aggregation.data._id]
                                },
                                detail: {
                                    description: error
                                }
                            }, () => {
                                resolve();
                            });
                        } else {
                            resolve();
                        }
                    })
                }
            },
            true
        );
    });
}
/**
 * Remove exams files
 * @param typeFolder {string} specific file path
 * @param fileName {string} file name
 * @param fileExtension {string} file extension
 * @param callback {Function} Callback
 */
function removeFile(typeFolder, fileName, fileExtension, callback) {
    let filePath = path.normalize(Config.FileResource.PATH.BASE + typeFolder + '/' + fileName + '.' + fileExtension);
    fs.unlink(filePath, (error) => {
        if (error) callback(null, error);
        else callback();
    });
}

run();