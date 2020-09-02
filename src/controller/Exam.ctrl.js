"use strict";
var fs,
    Canvas,
    ExamBo,
    jsfeat,
    WorkerManager,
    Enumerator,
    Config,
    Log;

fs = require('fs');
Canvas = require('canvas');
ExamBo = require('../lib/omr-base/business/Exam.bo');
jsfeat = require('jsfeat');
WorkerManager = require('../lib/omr-base/worker/WorkerManager');
Enumerator = require('../class/Enumerator');
Config = require('../config/Config');
Log = require('../lib/omr-base/class/Log');

class ExamController {

    /**
     * Constructor ExamController
     * @param template {Object}
     * @param exam {Object}
     */
    constructor(template, exam) {

        this.template = template;
        this.exam = exam;
        this.BO = new ExamBo(this.template);
        this.canvas = new Canvas(1275, 1650);//canvas principal instance
        this.context = this.canvas.getContext("2d");
        this.pixelCorners = {
            topLeft: {
                x: 1000,
                y: 1000
            },
            topRight: {
                x: 0,
                y: 1000
            },
            bottomLeft: {
                x: 1000,
                y: 0
            },
            bottomRight: {
                x: 0,
                y: 0
            },
            baseX: 0,
            baseY: 0,
            baseWidth: 0,
            baseHeight: 0,
            baseWidthWithOffset: 0,
            baseHeightWithOffset: 0,
            tileWidth: 0,
            tileHeight: 0,
            tileOffsetX: 2,
            tileOffsetY: 2
        };
        this.jsfeat = {
            instance: jsfeat,
            corners: [],
            countCorners: 0
        };
        this.image = {};
        this.countAnswerState = {
            [Enumerator.ExamQuestionState.CORRECT]: 0,
            [Enumerator.ExamQuestionState.INCORRECT]: 0,
            [Enumerator.ExamQuestionState.NULL]: 0,
            [Enumerator.ExamQuestionState.ERASED]: 0
        };
        this.orientation = "LANDSCAPE";

        process["Exam"] = this.exam;
    }

    /**
     * Start image processing
     * @param callback
     */
    startProcessing(callback) {
        this.callback = callback;
        let wM = new WorkerManager();

        /**
         * name: IMG_LOAD_FILE
         */
        wM.Push({
            name: "IMG_LOAD_FILE",
            job: (function () {
                let _c, Data;
                return {
                    Config: function (_callback, _sharedData) {
                        _c = _callback;
                        Data = _sharedData;
                    }.bind(this),
                    Run: function () {

                        ExamController.getFile(this.exam, (err, data) => {
                            if (err) return _c(err);

                            this.image.data = data;
                            _c();
                        })

                    }.bind(this)
                }
            }.bind(this))()
        });
        /**
         * name: DB_SET_PRE-PROCESSING
         */
        wM.Push({
            name: "DB_SET_PROCESSING",
            depends: "IMG_LOAD_FILE",
            job: (function () {
                var _c, Data;
                return {
                    Config: function (_callback, _sharedData) {
                        _c = _callback;
                        Data = _sharedData;
                    }.bind(this),
                    Run: function () {

                        this.exam.processStatus = Enumerator.ProcessStatus.PROCESSING;
                        this.Update(this.exam, _c);

                    }.bind(this)
                }
            }.bind(this))()
        });
        /**
         * name: DrawImage
         * depends: DB_SET_PROCESSING
         */
        wM.Push({
            name: WorkerManager.JobList.DrawImage,
            job: WorkerManager.JobList.DrawImage,
            depends: "DB_SET_PROCESSING",
            params: [
                this.canvas,
                this.context,
                Canvas.Image,
                this.image
            ]
        });

        /**
         * name: FindClippingPoint
         * depends: DrawImage
         */
        wM.Push({
            name: WorkerManager.JobList.FindClippingPoint,
            job: WorkerManager.JobList.FindClippingPoint,
            params: [
                this.canvas,
                this.context,
                this.image,
                Canvas.Image,
                Config
            ],
            depends: WorkerManager.JobList.DrawImage
        }); 

        /**
         * name: CropImage
         * depends: FindClippingPoint
         */
        wM.Push({
            name: WorkerManager.JobList.CropImage,
            job: WorkerManager.JobList.CropImage,
            params: [
                this.canvas,
                this.context,
                this.image,
                Config.CropRate['COLUMNS' + this.template.columns].X,
                Config.CropRate['COLUMNS' + this.template.columns].Y,
                Config.CropRate['COLUMNS' + this.template.columns].WIDTH,
                Config.CropRate['COLUMNS' + this.template.columns].HEIGHT
            ],
            depends: WorkerManager.JobList.FindClippingPoint
        });

        /**
         * name: ImageBin
         * depends: CropImage
         */
        wM.Push({
            name: WorkerManager.JobList.ImageBin,
            job: WorkerManager.JobList.ImageBin,
            params: [
                this.context,
                this.image
            ],
            depends: WorkerManager.JobList.CropImage
        });

        /**
         * name: PrepareCornerDetection align
         * depends: ImageBin
         */
        wM.Push({
            name: WorkerManager.JobList.PrepareCornerDetection + "align",
            job: WorkerManager.JobList.PrepareCornerDetection,
            params: [
                this.canvas,
                this.jsfeat,
                this.image
            ],
            depends: WorkerManager.JobList.ImageBin
        });

        /**
         * name: DetectCorner align
         * depends: PrepareCornerDetection align
         */
        wM.Push({
            name: WorkerManager.JobList.DetectCorner + "align",
            job: WorkerManager.JobList.DetectCorner,
            params: [
                this.canvas,
                this.context,
                this.image,
                this.jsfeat,
                false
            ],
            depends: WorkerManager.JobList.PrepareCornerDetection + "align"
        });

        /**
         * name: AlignImage
         * depends: DetectCorner align
         */
        wM.Push({
            name: WorkerManager.JobList.AlignImage,
            job: WorkerManager.JobList.AlignImage,
            params: [
                this.canvas,
                this.context,
                Canvas,
                this.jsfeat,
                this.image
            ],
            depends: WorkerManager.JobList.DetectCorner + "align"
        });

        /**
         * name: PrepareCornerDetection
         * depends: AlignImage
         */
        wM.Push({
            name: WorkerManager.JobList.PrepareCornerDetection,
            job: WorkerManager.JobList.PrepareCornerDetection,
            params: [
                this.canvas,
                this.jsfeat,
                this.image
            ],
            depends: WorkerManager.JobList.AlignImage
        });
        /**
         * name: DetectCorner
         * depends: PrepareCornerDetection
         */
        wM.Push({
            name: WorkerManager.JobList.DetectCorner,
            job: WorkerManager.JobList.DetectCorner,
            params: [
                this.canvas,
                this.context,
                this.image,
                this.jsfeat,
                false
            ],
            depends: WorkerManager.JobList.PrepareCornerDetection
        });
        /**
         * name: FilterCorner
         * depends: DetectCorner
         */
        wM.Push({
            name: WorkerManager.JobList.FilterCorner,
            job: WorkerManager.JobList.FilterCorner,
            params: [
                this.canvas,
                this.jsfeat,
                this.pixelCorners,
                this.template,
                Config.TemplateOffset
            ],
            depends: WorkerManager.JobList.DetectCorner
        });

        /**
         * name: ValidateTemplate
         * depends: FilterCorner
         */
        wM.Push({
            name: WorkerManager.JobList.ValidateTemplate,
            job: WorkerManager.JobList.ValidateTemplate,
            params: [
                Canvas,
                this.context,
                this.pixelCorners,
                this.template,
                Config.TemplateOffset
            ],
            depends: WorkerManager.JobList.FilterCorner
        });
        /**
         * name: DrawGrid
         * depends: ValidateTemplate
         */
        //wM.Push({
        //    name: WorkerManager.JobList.DrawGrid,
        //    job: WorkerManager.JobList.DrawGrid,
        //    params: [
        //        this.context,
        //        this.pixelCorners,
        //        this.template
        //    ],
        //    depends: WorkerManager.JobList.ValidateTemplate
        //});
        /**
         * name: VerifyTemplateFill
         * depends: DrawGrid
         */
        wM.Push({
            name: WorkerManager.JobList.VerifyTemplateFill,
            job: WorkerManager.JobList.VerifyTemplateFill,
            params: [
                this.canvas,
                this.context,
                this.image,
                this.template,
                this.pixelCorners,
                this.orientation
            ],
            depends: WorkerManager.JobList.ValidateTemplate
        });
        /**
         * name: checkTemplateAnswers
         * depends: VerifyTemplateFill
         */
        wM.Push({
            name: "checkTemplateAnswers",
            depends: WorkerManager.JobList.VerifyTemplateFill,
            job: (function () {
                var _c, Data;
                return {
                    Config: function (_callback, _sharedData) {
                        _c = _callback;
                        Data = _sharedData;
                    }.bind(this),
                    Run: function () {
                        Data.answers = this.checkTemplateAnswers(Data.insertedAnswers);
                        _c();

                    }.bind(this)
                }
            }.bind(this))()
        });
        /**
         * name: updateDb
         * depends: checkTemplateAnswers
         */
        wM.Push({
            name: "updateDb",
            depends: "checkTemplateAnswers",
            job: (function () {
                var _c, Data;
                return {
                    Config: function (_callback, _sharedData) {
                        _c = _callback;
                        Data = _sharedData;
                    }.bind(this),
                    Run: function () {

                        this.exam.answers = Data.answers;
                        this.exam.correctCount = this.countAnswerState[Enumerator.ExamQuestionState.CORRECT];
                        this.exam.incorrectCount = this.countAnswerState[Enumerator.ExamQuestionState.INCORRECT];
                        this.exam.nullCount = this.countAnswerState[Enumerator.ExamQuestionState.NULL];
                        this.exam.erasedCount = this.countAnswerState[Enumerator.ExamQuestionState.ERASED];

                        this.exam.processStatus = ExamController.WarningThreshold(this.exam.nullCount, this.exam.erasedCount, this.exam.answers.length);
                        _c();
                    }.bind(this)
                }
            }.bind(this))()
        });

        wM.RunJob(this.JobCallback.bind(this));
    }

    /**
     *
     * @param err
     * @constructor
     */
    JobCallback(err) {
        var errors = [], ret = {};
        if (err) {
            errors.push(err);
            this.exam.processStatus = Enumerator.ProcessStatus.ERROR;
        }

        this.Update(this.exam, (err) => {
            if (err) errors.push(err);

            ret = {ErrorList: errors};
            ret['Exam'] = this.exam;

            if (Config.KeepResults(this.exam.processStatus, Enumerator.ProcessStatus, Enumerator.KeepResultLevel) === true) {
                this.saveProcessedImage(this.exam, function (err) {
                    if (err) errors.push(err);

                    this.callback(null, ret);
                }.bind(this));
            } else this.callback(null, ret);
        });
    }

    /**
     * Save processed image for debug
     * @param exam {Function}
     * @param callback {Function}
     */
    saveProcessedImage(exam, callback) {
        let filePath = Config.FileResource.PATH.BASE + Config.FileResource.DIRECTORY.RESULT + "/" + exam._id + '.' + Enumerator.FileExtensions.PNG;

        fs.open(filePath, 'w', (error, fd) => {
            if (error) return callback(error);

            this.canvas.toBuffer(function (error, buffer) {
                if (error) return callback(error);

                fs.write(fd, buffer, 0, buffer.length, null, (error) => {
                    if (error) return callback(error);
                    fs.close(fd);
                    return callback();
                })
            });
        });
    }

    /**
     * Get file in path
     * @param exam {Object}
     * @param callback {Function}
     */
    static getFile(exam, callback) {
        var filePath = Config.FileResource.PATH.BASE + Config.FileResource.DIRECTORY.EQUALIZED + "/" + exam._id + '.' + Enumerator.FileExtensions.PNG;

        fs.open(filePath, 'r', (error, fd) => {
            if (error) return callback(error);

            fs.stat(filePath, (error, stat) => {
                var buffer;
                if (error) return callback(error);

                buffer = new Buffer(stat.size);

                fs.read(fd, buffer, 0, buffer.length, null, (error, bytesRead, buffer) => {
                    if (error) return callback(error);
                    fs.close(fd);
                    return callback(null, buffer);
                })
            });
        });
    }

    /**
     * Inserted compare answers with correct answers
     * @param insertedAnswers {Object[]} list of answers
     */
    checkTemplateAnswers(insertedAnswers) {

        let answers = [], state;
        // let items = this.template.items.filter(item => !item.ignore);
        let items = this.template.items;
        // let centerFill = false;

        for (let i = 0; i < items.length; i++) {

            if (!items[i].ignore) {

                state = !insertedAnswers[i].inconsistency ?
                    (
                        this.template.items[i].answers[insertedAnswers[i].alternative] == this.template.items[i].correctId ?
                            Enumerator.ExamQuestionState.CORRECT :
                            Enumerator.ExamQuestionState.INCORRECT
                    ) :
                    (
                        insertedAnswers[i].inconsistency == "null" ?
                            Enumerator.ExamQuestionState.NULL :
                            Enumerator.ExamQuestionState.ERASED
                    );

                this.countAnswerState[state] += 1;

                answers.push({
                    answer: this.template.items[i].answers[insertedAnswers[i].alternative],
                    state: state
                });
            }

            //Check absence
            // if (i !== 0 && i !== items.length - 1 && state !== Enumerator.ExamQuestionState.NULL) {
            //     centerFill = true;
            // }
        }

        //absence
        // if (answers[0].state === Enumerator.ExamQuestionState.ERASED && !centerFill &&
        //     answers[items.length - 1].state === Enumerator.ExamQuestionState.ERASED) {
        //     this.exam.absence = true;
        // }

        return answers;
    }

    /**
     * Get Process Status using Warning Threshold
     * @return {Number}
     * @static
     */
    static WarningThreshold(nullCount, erasedCount, total) {
        var percent = (nullCount + erasedCount) / total * 100;
        if (percent > Config.WarningThreshold) return Enumerator.ProcessStatus.WARNING;
        else return Enumerator.ProcessStatus.SUCCESS;
    }

    /**
     * Update BO
     * @param exam
     * @param callback
     */
    Update(exam, callback) {
        this.BO.Update(exam._id, exam, callback);
    }
}

module.exports = ExamController;