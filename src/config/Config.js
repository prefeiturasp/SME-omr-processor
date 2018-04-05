"use strict";
var ConfigBase = require('../lib/omr-base/config/Config');

class Config extends ConfigBase {


    /**
     *
     * @returns {{X: number, Y: number, WIDTH: number, HEIGHT: number}}
     * @constructor
     */
    static get CropRate() {
        return {
            COLUMNS1: {
                X: Config.resource.CROPRATE_C1_X || .25,            //[0..0.99]
                Y: Config.resource.CROPRATE_C1_Y || .43,             //[0..0.99]
                WIDTH: Config.resource.CROPRATE_C1_WIDTH || .65,    //[0.1..1]
                HEIGHT: Config.resource.CROPRATE_C1_HEIGHT || 1     //[0.1..1]
            },
            COLUMNS2: {
                X: Config.resource.CROPRATE_C2_X || .2,             //[0..0.99]
                Y: Config.resource.CROPRATE_C2_Y || .43,             //[0..0.99]
                WIDTH: Config.resource.CROPRATE_C2_WIDTH || .75,    //[0.1..1]
                HEIGHT: Config.resource.CROPRATE_C2_HEIGHT || 1     //[0.1..1]
            },
            COLUMNS3: {
                X: Config.resource.CROPRATE_C3_X || .1,             //[0..0.99]
                Y: Config.resource.CROPRATE_C3_Y || .43,             //[0..0.99]
                WIDTH: Config.resource.CROPRATE_C3_WIDTH || .85,    //[0.1..1]
                HEIGHT: Config.resource.CROPRATE_C3_HEIGHT || 1     //[0.1..1]
            },
            COLUMNS4: {
                X: Config.resource.CROPRATE_C4_X || .0,             //[0..0.99]
                Y: Config.resource.CROPRATE_C4_Y || .43,             //[0..0.99]
                WIDTH: Config.resource.CROPRATE_C4_WIDTH || .0,     //[0.1..1]
                HEIGHT: Config.resource.CROPRATE_C4_HEIGHT || 1     //[0.1..1]
            },
            COLUMNS5: {
                X: Config.resource.CROPRATE_C4_X || .0,             //[0..0.99]
                Y: Config.resource.CROPRATE_C4_Y || .43,             //[0..0.99]
                WIDTH: Config.resource.CROPRATE_C4_WIDTH || .0,     //[0.1..1]
                HEIGHT: Config.resource.CROPRATE_C4_HEIGHT || 1     //[0.1..1]
            }
        }
    }

    /**
     *
     * @returns {{LEFT: number, RIGHT: number, TOP: number, BOTTOM: number}}
     * @constructor
     */
    static get TemplateOffset() {
        return {
            LEFT: Config.resource.TEMPLATE_OFFSET_LEFT || 2,
            RIGHT: Config.resource.TEMPLATE_OFFSET_RIGHT || 1,
            TOP: Config.resource.TEMPLATE_OFFSET_TOP || 2,
            BOTTOM: Config.resource.TEMPLATE_OFFSET_BOTTOM || 0
        }
    }

    /**
     * Get Warning Threshold percent
     * @return {Number}
     * @static
     */
    static get WarningThreshold() {
        return Config.resource.EXAM_WARNING_THRESHOLD || 1
    }
}

module.exports = Config;