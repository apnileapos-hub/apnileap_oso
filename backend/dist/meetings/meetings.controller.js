"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MeetingsController = void 0;
const common_1 = require("@nestjs/common");
const meetings_service_1 = require("./meetings.service");
const auth_guard_1 = require("../auth/guards/auth.guard");
let MeetingsController = class MeetingsController {
    constructor(meetingsService) {
        this.meetingsService = meetingsService;
    }
    async getMeetings() {
        return this.meetingsService.getMeetings();
    }
    async createMeeting(body, req) {
        const actor = req.user?.name || req.user?.email || 'System';
        return this.meetingsService.createMeeting(body, actor);
    }
    async getMessages(meetingId) {
        return this.meetingsService.getMeetingMessages(meetingId);
    }
    async postMessage(meetingId, body, req) {
        const actor = req.user?.name || req.user?.email || 'System';
        return this.meetingsService.postMeetingMessage(meetingId, body, actor);
    }
    async sendReminder(id, req) {
        const actor = req.user?.name || req.user?.email || 'System';
        return this.meetingsService.sendPrepReminder(id, actor);
    }
    async deleteMeeting(meetId, req) {
        const actor = req.user?.name || req.user?.email || 'System';
        return this.meetingsService.deleteMeeting(meetId, actor);
    }
};
exports.MeetingsController = MeetingsController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "getMeetings", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "createMeeting", null);
__decorate([
    (0, common_1.Get)(':meetingId/messages'),
    __param(0, (0, common_1.Param)('meetingId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "getMessages", null);
__decorate([
    (0, common_1.Post)(':meetingId/messages'),
    __param(0, (0, common_1.Param)('meetingId')),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "postMessage", null);
__decorate([
    (0, common_1.Post)(':id/remind'),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "sendReminder", null);
__decorate([
    (0, common_1.Delete)(':meetId'),
    __param(0, (0, common_1.Param)('meetId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], MeetingsController.prototype, "deleteMeeting", null);
exports.MeetingsController = MeetingsController = __decorate([
    (0, common_1.Controller)('api/meetings'),
    (0, common_1.UseGuards)(auth_guard_1.AuthGuard),
    __metadata("design:paramtypes", [meetings_service_1.MeetingsService])
], MeetingsController);
//# sourceMappingURL=meetings.controller.js.map