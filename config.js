"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initConfig = exports.RandomInfoConfig = void 0;
const tslib_1 = require('tslib');
const SubConfigClass_1 = require('typeconfig/src/decorators/class/SubConfigClass');
const ConfigPropoerty_1 = require('typeconfig/src/decorators/property/ConfigPropoerty');

let RandomInfoConfig = class RandomInfoConfig {
    constructor() {
        // If true, include videos in random selection. Default: false (photos only).
        this.allowVideos = false;
    }
};
tslib_1.__decorate([
    (0, ConfigPropoerty_1.ConfigProperty)({
        tags: {
            name: `Allow videos`,
            priority: 2
        },
        description: `If true, include videos in random selection.`
    }),
    tslib_1.__metadata("design:type", Boolean)
], RandomInfoConfig.prototype, "allowVideos", void 0);
RandomInfoConfig = tslib_1.__decorate([
    (0, SubConfigClass_1.SubConfigClass)({ softReadonly: true })
], RandomInfoConfig);
(0, ConfigPropoerty_1.ConfigProperty)({
    tags: {
        name: `Allow videos`,
        priority: 2
    },
    description: `If true, include videos in random selection.`
})(RandomInfoConfig.prototype, "allowVideos");
exports.RandomInfoConfig = RandomInfoConfig;
const initConfig = (extension) => {
    extension.setConfigTemplate(RandomInfoConfig);
};
exports.initConfig = initConfig;

