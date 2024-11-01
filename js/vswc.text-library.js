// *****************************************************************************************************
// *******              speak2web VOICE SEARCH FOR WooCommerce                                    ***********
// *******               AI Service requires subcriptions                                    ***********
// *******               Get your subscription at                                            ***********
// *******                    https://speak2web.com/plugin#plans                             ***********
// *******               Need support? https://speak2web.com/support                         ***********
// *******               Licensed GPLv2+                                                     ***********
//******************************************************************************************************


//####################################
// PLUGIN LANGUAGE
//####################################
var vswcTypeOfSelectedLanguage = (typeof (vswc.vswcSelectedLanguage) != 'undefined' && vswc.vswcSelectedLanguage !== null) ? vswc.vswcSelectedLanguage.trim() : 'English';
var vswcSelectedLang = (typeof (vswc.vswcSelectedLanguage) != 'undefined' && vswc.vswcSelectedLanguage !== null) ? vswc.vswcSelectedLanguage.trim() : 'en-US';

var vswcIsSttLangCtx = typeof _vswcSttLanguageContext != 'undefined' && !!_vswcSttLanguageContext && _vswcSttLanguageContext instanceof Object ? true : false;
var vswcSttLanguageContext = {
    'gcp': {
        'stt': null,
        'langCode': null,
        'endPoint': null,
        'key': null,
        'qs': { 'key': null }
    }
}

if (vswcIsSttLangCtx === true) {
    //###############################
    // GCP
    //###############################
    let gcp = 'gcp' in _vswcSttLanguageContext && _vswcSttLanguageContext['gcp'] instanceof Object ? _vswcSttLanguageContext['gcp'] : {};
    vswcSttLanguageContext['gcp']['stt'] = 'stt' in gcp && gcp['stt'] == 'Y' ? true : false;

    if (!!vswcSttLanguageContext['gcp']['stt']) {
        vswcSttLanguageContext['gcp']['endPoint'] = 'endPoint' in gcp && typeof gcp['endPoint'] != 'undefined' && !!gcp['endPoint'] ? gcp['endPoint'] : null;
        vswcSttLanguageContext['gcp']['key'] = 'key' in gcp && typeof gcp['key'] != 'undefined' && !!gcp['key'] ? gcp['key'] : null;
        vswcSttLanguageContext['gcp']['langCode'] = 'langCode' in gcp && typeof gcp['langCode'] != 'undefined' && !!gcp['langCode'] ? gcp['langCode'] : null;

        let qs = 'qs' in gcp && gcp['qs'] instanceof Object ? gcp['qs'] : {};
        vswcSttLanguageContext['gcp']['qs']['key'] = 'key' in qs && typeof qs['key'] != 'undefined' && !!qs['key'] ? qs['key'] : null;
    }
}

//####################################
// CLIENT INFO
//####################################
let vswcNavigator = { 'navigatorUserAgent': navigator.userAgent.toLowerCase(), 'navigatorPlatform': navigator.platform };
var vswcClientInfo = {
    'chrome': vswcNavigator.navigatorUserAgent.indexOf('chrome') > -1,
    'firefox': vswcNavigator.navigatorUserAgent.indexOf('firefox') > -1,
    'edge': vswcNavigator.navigatorUserAgent.indexOf('edge') > -1 || vswcNavigator.navigatorUserAgent.indexOf('edg') > -1,
    'ie': vswcNavigator.navigatorUserAgent.indexOf('msie') > -1 || vswcNavigator.navigatorUserAgent.indexOf('trident') > -1,
    'opera': vswcNavigator.navigatorUserAgent.indexOf('opera') > -1 || vswcNavigator.navigatorUserAgent.indexOf('opr') > -1,

    'ios': !!vswcNavigator.navigatorPlatform && /iPad|iPhone|iPod/.test(vswcNavigator.navigatorPlatform),
    'android': vswcNavigator.navigatorUserAgent.indexOf("android") > -1,
    'windows': vswcNavigator.navigatorUserAgent.indexOf("windows") > -1,
    'linux': vswcNavigator.navigatorUserAgent.indexOf("linux") > -1,

    'macSafari': vswcNavigator.navigatorUserAgent.indexOf('mac') > -1 && vswcNavigator.navigatorUserAgent.indexOf('safari') > -1 && vswcNavigator.navigatorUserAgent.indexOf('chrome') === -1,
    'iosSafari': this.ios === true && vswcNavigator.navigatorUserAgent.indexOf('safari') > -1,
};

if (vswcClientInfo['chrome'] === true && (vswcClientInfo['opera'] === true || vswcClientInfo['edge'] === true)) {
    vswcClientInfo['chrome'] = false;
}

/**
 * Path map for audio files of short phrases
 * 
 */
var vswcAudioShortPharasesPaths = {
    'root': 'short_phrases/',
    'voice': vswcSelectedLang + '/',
    'random': 'random/',
    'general': 'general/',
    'getRandomVoicesPath': function () {
        return this.root + this.random + this.voice + vswcSelectedLang + '_';
    },
    'getGeneralVoicesPath': function () {
        return this.root + this.general + this.voice + vswcSelectedLang + '_';
    }
}

let vswcRandomShortPhrasePath = vswcAudioShortPharasesPaths.getRandomVoicesPath();
let vswcGeneralShortPhrasePath = vswcAudioShortPharasesPaths.getGeneralVoicesPath();
let vswcSilenceSoundPath = vswcAudioShortPharasesPaths.root + 'silence.mp3';

/**
 * Alternative response audio files to be played/spoken
 *
 */
var vswcAlternativeResponse = {
    /**
     * Text in audio file: Let me search it
     */
    'basic': vswcGeneralShortPhrasePath + "basic.mp3",
    /**
     * Text in audio file: I am sorry but I am unable to access your microphone, Please connect a microphone or you can also type your question if needed
     */
    'micConnect': vswcGeneralShortPhrasePath + "mic_connect.mp3",
    /**
     * Text in audio file: Voice search is currently unavailable, Please try again after some time
     */
    'unavailable': vswcGeneralShortPhrasePath + "unavailable.mp3",
    /**
     * Text in audio file: I am unable to hear you
     */
    'notAudible': vswcGeneralShortPhrasePath + "not_audible.mp3",
    'randomLib': [
        /**
         * Text in audio file: Just a second please
         */
        vswcRandomShortPhrasePath + "0.mp3",
        /**
         * Text in audio file: I am on it
         */
        vswcRandomShortPhrasePath + "1.mp3",
        /**
         * Text in audio file: No problem
         */
        vswcRandomShortPhrasePath + "2.mp3",
        /**
         * Text in audio file: Just a moment, I need a brief rest
         */
        vswcRandomShortPhrasePath + "3.mp3",
        /**
         * Text in audio file: You seem to work too hard, Get your self a coffee and I will find it up for you
         */
        vswcRandomShortPhrasePath + "4.mp3",
        /**
         * Text in audio file: Coming right up
         */
        vswcRandomShortPhrasePath + "5.mp3",
        /**
         * Text in audio file: I will do my best
         */
        vswcRandomShortPhrasePath + "6.mp3",
        /**
         * Text in audio file: Anything for you. I will get right on it
         */
        vswcRandomShortPhrasePath + "7.mp3",
        /**
         * Text in audio file: Working on it, One moment please
         */
        vswcRandomShortPhrasePath + "8.mp3",
        /**
         * Text in audio file: Beep - Beep - Beep, just kidding, One moment please
         */
        vswcRandomShortPhrasePath + "9.mp3"
    ],
};

var vswcMessages = _vswcTextPhrases['vswcMessages'];
var vswcErrorLibrary = _vswcTextPhrases['vswcErrorLibrary'];
var vswcWidgetMessages = _vswcTextPhrases['vswcWidgetMessages'];

var vswcIsMuteSimon = typeof vswc._vswcMuteAudioPhrases != 'undefined' && !!vswc._vswcMuteAudioPhrases && vswc._vswcMuteAudioPhrases == 'yes' ? true : false;
var vswcIsSingleClick = typeof vswc._vswcSingleClick != 'undefined' && !!vswc._vswcSingleClick && vswc._vswcSingleClick == 'yes' ? true : false;
var vswcIsElementor = typeof vswc._vswcElementor != 'undefined' && !!vswc._vswcElementor && vswc._vswcElementor == 'yes' ? true : false;
