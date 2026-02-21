/* ─── i18n type definitions ────────────────────────────── */

/** Every translation key used across the app. */
export interface Translations {
  // ── Common ──
  "common.loading": string;
  "common.save": string;
  "common.cancel": string;
  "common.create": string;
  "common.delete": string;
  "common.remove": string;
  "common.search": string;
  "common.go": string;
  "common.send": string;
  "common.back": string;
  "common.done": string;
  "common.or": string;
  "common.yes": string;
  "common.no": string;
  "common.ok": string;
  "common.confirm": string;
  "common.error": string;
  "common.success": string;
  "common.today": string;
  "common.yesterday": string;

  // ── Home / Landing ──
  "home.tagline": string;
  "home.subtitle": string;
  "home.voiceCalls": string;
  "home.voiceCallsDesc": string;
  "home.videoCalls": string;
  "home.videoCallsDesc": string;
  "home.latency": string;
  "home.latencyDesc": string;
  "home.chat": string;
  "home.chatDesc": string;
  "home.lifetimeChat": string;
  "home.voiceCredits": string;
  "home.login": string;
  "home.signup": string;
  "home.poweredBy": string;
  "home.terms": string;
  "home.privacy": string;

  // ── Auth ──
  "auth.welcomeBack": string;
  "auth.createAccount": string;
  "auth.emailOrUsername": string;
  "auth.email": string;
  "auth.username": string;
  "auth.displayName": string;
  "auth.password": string;
  "auth.yourLanguage": string;
  "auth.login": string;
  "auth.loggingIn": string;
  "auth.signup": string;
  "auth.creatingAccount": string;
  "auth.dontHaveAccount": string;
  "auth.alreadyHaveAccount": string;
  "auth.forgotPassword": string;
  "auth.tryDemo": string;
  "auth.agreeToTerms": string;
  "auth.termsOfService": string;
  "auth.privacyPolicy": string;
  "auth.and": string;

  // ── Forgot / Reset Password ──
  "auth.resetPassword": string;
  "auth.resetPasswordDesc": string;
  "auth.resetLinkSent": string;
  "auth.sendResetLink": string;
  "auth.sending": string;
  "auth.rememberPassword": string;
  "auth.setNewPassword": string;
  "auth.setNewPasswordDesc": string;
  "auth.newPassword": string;
  "auth.confirmPassword": string;
  "auth.atLeast6Chars": string;
  "auth.repeatPassword": string;
  "auth.resetting": string;
  "auth.passwordResetSuccess": string;
  "auth.passwordsMustMatch": string;
  "auth.passwordTooShort": string;
  "auth.missingResetToken": string;
  "auth.backToLogin": string;

  // ── Dashboard ──
  "dash.chats": string;
  "dash.friends": string;
  "dash.settings": string;
  "dash.logout": string;
  "dash.newChat": string;
  "dash.selectChat": string;
  "dash.autoTranslated": string;

  // ── Chat List ──
  "chatList.search": string;
  "chatList.noChats": string;
  "chatList.noChatsYet": string;
  "chatList.noMessages": string;
  "chatList.groupChat": string;

  // ── Chat View ──
  "chatView.members": string;
  "chatView.speaks": string;
  "chatView.noMessagesYet": string;
  "chatView.autoTranslatedMsg": string;
  "chatView.showTranslated": string;
  "chatView.showOriginal": string;
  "chatView.isTyping": string;
  "chatView.areTyping": string;
  "chatView.typeMessage": string;
  "chatView.autoTranslatingTo": string;
  "chatView.failedStartCall": string;
  "chatView.voiceCall": string;
  "chatView.videoCall": string;
  "chatView.groupSettings": string;
  "chatView.language": string;
  "chatView.receiveMessagesIn": string;
  "chatView.updating": string;

  // ── Friends ──
  "friends.friends": string;
  "friends.requests": string;
  "friends.search": string;
  "friends.noFriends": string;
  "friends.message": string;
  "friends.unfriend": string;
  "friends.noRequests": string;
  "friends.accept": string;
  "friends.reject": string;
  "friends.searchPlaceholder": string;
  "friends.requestSent": string;
  "friends.sendRequest": string;
  "friends.removeFriend": string;
  "friends.failedRequest": string;

  // ── New Chat Modal ──
  "newChat.title": string;
  "newChat.directMessage": string;
  "newChat.groupChat": string;
  "newChat.groupName": string;
  "newChat.selectFriend": string;
  "newChat.selectMembers": string;
  "newChat.addFriendsFirst": string;
  "newChat.selectOneFriend": string;
  "newChat.selectAtLeastOne": string;
  "newChat.enterGroupName": string;
  "newChat.failedCreate": string;

  // ── Voice Setup ──
  "voiceSetup.title": string;
  "voiceSetup.subtitle": string;
  "voiceSetup.feature1Title": string;
  "voiceSetup.feature1Desc": string;
  "voiceSetup.feature2Title": string;
  "voiceSetup.feature2Desc": string;
  "voiceSetup.feature3Title": string;
  "voiceSetup.feature3Desc": string;
  "voiceSetup.consent": string;
  "voiceSetup.consentText": string;
  "voiceSetup.consentCheckbox": string;
  "voiceSetup.setupBtn": string;
  "voiceSetup.skip": string;
  "voiceSetup.recordTitle": string;
  "voiceSetup.recordDesc": string;
  "voiceSetup.creatingTitle": string;
  "voiceSetup.creatingDesc": string;
  "voiceSetup.doneTitle": string;
  "voiceSetup.doneDesc": string;
  "voiceSetup.proTip": string;
  "voiceSetup.startChatting": string;
  "voiceSetup.failedClone": string;

  // ── Voice Recorder ──
  "recorder.start": string;
  "recorder.stop": string;
  "recorder.pause": string;
  "recorder.play": string;
  "recorder.reRecord": string;
  "recorder.useThis": string;
  "recorder.recordAtLeast": string;
  "recorder.minReached": string;
  "recorder.moreNeeded": string;
  "recorder.reviewOrReRecord": string;
  "recorder.tips": string;
  "recorder.tip1": string;
  "recorder.tip2": string;
  "recorder.tip3": string;
  "recorder.tip4": string;
  "recorder.tip5": string;
  "recorder.micDenied": string;

  // ── Call ──
  "call.incomingCall": string;
  "call.decline": string;
  "call.accept": string;
  "call.failedJoin": string;
  "call.startCall": string;
  "call.startCallWith": string;
  "call.voiceCall": string;
  "call.videoCall": string;
  "call.failedStart": string;
  "call.you": string;
  "call.participant": string;
  "call.joining": string;
  "call.ended": string;
  "call.backToDashboard": string;
  "call.onHold": string;
  "call.locked": string;
  "call.participants": string;
  "call.muted": string;
  "call.speaking": string;
  "call.listening": string;
  "call.inCallChat": string;
  "call.messagePlaceholder": string;
  "call.aiAssistant": string;
  "call.suggestion": string;
  "call.getSuggestion": string;
  "call.transferCall": string;
  "call.selectRecipient": string;
  "call.transfer": string;
  "call.createPoll": string;
  "call.question": string;
  "call.addOption": string;
  "call.mute": string;
  "call.unmute": string;
  "call.cameraOn": string;
  "call.cameraOff": string;
  "call.shareScreen": string;
  "call.stopSharing": string;
  "call.hold": string;
  "call.resume": string;
  "call.raiseHand": string;
  "call.startRecording": string;
  "call.stopRecording": string;
  "call.pauseRecording": string;
  "call.resumeRecording": string;
  "call.whiteboard": string;
  "call.closeWhiteboard": string;
  "call.videoQuality": string;
  "call.autoDetect": string;
  "call.notifications": string;
  "call.noNotifications": string;
  "call.leaveCall": string;
  "call.endCall": string;
  "call.endAll": string;
  "call.endForEveryone": string;
  "call.callInProgress": string;
  "call.join": string;
  "call.participantCount": string;
  "call.original": string;
  "call.translation": string;
  "call.missingConnection": string;
  "call.settings": string;

  // ── Group Settings ──
  "group.settings": string;
  "group.groupName": string;
  "group.members": string;
  "group.addMember": string;
  "group.addFromFriends": string;
  "group.allMembersAdded": string;
  "group.admin": string;
  "group.you": string;
  "group.makeAdmin": string;
  "group.removeMember": string;
  "group.confirmRemove": string;
  "group.confirmTransfer": string;
  "group.leaveGroup": string;
  "group.confirmLeave": string;
  "group.close": string;

  // ── Settings ──
  "settings.myAccount": string;
  "settings.profileLanguageVoice": string;
  "settings.notificationsAndSounds": string;
  "settings.ringtonesTonesDND": string;
  "settings.privacyAndSecurity": string;
  "settings.lastSeenReadReceipts": string;
  "settings.chatSettings": string;
  "settings.appearanceTranslation": string;
  "settings.folders": string;
  "settings.organizeChats": string;
  "settings.advanced": string;
  "settings.dataStorageProxy": string;
  "settings.speakersAndCamera": string;
  "settings.audioVideoDevices": string;
  "settings.batteryAndAnimations": string;
  "settings.performanceOptions": string;
  "settings.paymentsAndCredits": string;
  "settings.manageBilling": string;
  "settings.credits": string;
  "settings.appLanguage": string;
  "settings.appLanguageDesc": string;

  // ── Account section ──
  "account.displayName": string;
  "account.bio": string;
  "account.bioPlaceholder": string;
  "account.usernameLabel": string;
  "account.myLanguage": string;
  "account.myLanguageDesc": string;
  "account.voiceProfile": string;
  "account.voiceProfileDesc": string;
  "account.voiceActive": string;
  "account.reRecord": string;
  "account.noVoice": string;
  "account.setupVoice": string;
  "account.creatingVoice": string;
  "account.saveChanges": string;
  "account.saved": string;
  "account.accountActions": string;
  "account.changePassword": string;
  "account.currentPassword": string;
  "account.newPasswordPlaceholder": string;
  "account.updatePassword": string;
  "account.deleteAccount": string;
  "account.deleteAccountDesc": string;
  "account.confirmDelete": string;
  "account.yourPassword": string;

  // ── Notifications section ──
  "notif.pushNotifications": string;
  "notif.messageNotifications": string;
  "notif.callNotifications": string;
  "notif.friendRequestAlerts": string;
  "notif.emailNotifications": string;
  "notif.emailMissedCalls": string;
  "notif.emailFriendRequests": string;
  "notif.sounds": string;
  "notif.soundEffects": string;
  "notif.vibration": string;
  "notif.ringtoneTones": string;
  "notif.ringtone": string;
  "notif.incomingCalls": string;
  "notif.notification": string;
  "notif.messageAlerts": string;
  "notif.groupTone": string;
  "notif.groupAlerts": string;
  "notif.dnd": string;
  "notif.enableDND": string;
  "notif.from": string;
  "notif.to": string;
  "notif.couldNotLoad": string;

  // ── Privacy section ──
  "privacy.privacy": string;
  "privacy.lastSeen": string;
  "privacy.lastSeenDesc": string;
  "privacy.profilePhoto": string;
  "privacy.profilePhotoDesc": string;
  "privacy.readReceipts": string;
  "privacy.readReceiptsDesc": string;
  "privacy.everyone": string;
  "privacy.contacts": string;
  "privacy.nobody": string;
  "privacy.security": string;
  "privacy.twoFactor": string;
  "privacy.twoFactorDesc": string;
  "privacy.activeSessions": string;
  "privacy.activeSessionsDesc": string;
  "privacy.couldNotLoad": string;

  // ── Chat Settings section ──
  "chatSettings.appearance": string;
  "chatSettings.fontSize": string;
  "chatSettings.small": string;
  "chatSettings.medium": string;
  "chatSettings.large": string;
  "chatSettings.wallpaper": string;
  "chatSettings.default": string;
  "chatSettings.dark": string;
  "chatSettings.gradient": string;
  "chatSettings.minimal": string;
  "chatSettings.behavior": string;
  "chatSettings.groupMessages": string;
  "chatSettings.groupMessagesDesc": string;
  "chatSettings.sendWithEnter": string;
  "chatSettings.sendWithEnterDesc": string;
  "chatSettings.autoTranslate": string;
  "chatSettings.autoTranslateDesc": string;
  "chatSettings.couldNotLoad": string;

  // ── Folders section ──
  "folders.title": string;
  "folders.desc": string;
  "folders.allChats": string;
  "folders.personal": string;
  "folders.groups": string;
  "folders.comingSoon": string;

  // ── Advanced section ──
  "adv.dataAndStorage": string;
  "adv.autoDownload": string;
  "adv.autoDownloadDesc": string;
  "adv.maxFileSize": string;
  "adv.dataSaver": string;
  "adv.dataSaverDesc": string;
  "adv.connection": string;
  "adv.useProxy": string;
  "adv.useProxyDesc": string;
  "adv.couldNotLoad": string;

  // ── Devices section ──
  "devices.microphone": string;
  "devices.speakers": string;
  "devices.camera": string;
  "devices.systemDefault": string;
  "devices.noMicrophones": string;
  "devices.noSpeakers": string;
  "devices.noCameras": string;
  "devices.audioProcessing": string;
  "devices.echoCancellation": string;
  "devices.noiseSuppression": string;
  "devices.autoGainControl": string;

  // ── Battery section ──
  "battery.performance": string;
  "battery.reduceAnimations": string;
  "battery.reduceAnimationsDesc": string;
  "battery.powerSaving": string;
  "battery.powerSavingDesc": string;
  "battery.media": string;
  "battery.autoPlayGifs": string;
  "battery.autoPlayGifsDesc": string;
  "battery.couldNotLoad": string;

  // ── Payments section ──
  "pay.chatPlan": string;
  "pay.lifetimeChatActive": string;
  "pay.unlimitedMessaging": string;
  "pay.chatPlanDesc": string;
  "pay.buyLifetimeChat": string;
  "pay.voiceVideoCredits": string;
  "pay.voiceCredits": string;
  "pay.purchased": string;
  "pay.used": string;
  "pay.topUp": string;
  "pay.buyCredits": string;
  "pay.showHistory": string;
  "pay.hideHistory": string;
  "pay.noTransactions": string;
  "pay.processing": string;
  "pay.failedCheckout": string;
  "pay.chatPlanLabel": string;
}

/** Supported locale code */
export type Locale = string;

/** A language definition */
export interface Language {
  code: string;
  name: string;       // name in that language
  nameEn: string;     // name in English
  flag: string;
  dir?: "ltr" | "rtl";
}
