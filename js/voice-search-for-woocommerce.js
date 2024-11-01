// *****************************************************************************************************
// *******              speak2web VOICE SEARCH FOR WooCommerce                                     ***********
// *******               Get your subscription at                                            ***********
// *******                    https://speak2web.com/plugin#plans                             ***********
// *******               Need support? https://speak2web.com/support                         ***********
// *******               Licensed GPLv2+                                                     ***********
//******************************************************************************************************
window.onload = (event) => {
    (function () {
        'use strict';

        // Auto timeout duration to stop listening Mic
        var vswcMicListenAutoTimeoutDuration = null;

        if (typeof (vswc.vswcMicListenTimeoutDuration) != 'undefined' && vswc.vswcMicListenTimeoutDuration !== null) {
            vswcMicListenAutoTimeoutDuration = parseInt(vswc.vswcMicListenTimeoutDuration);
            vswcMicListenAutoTimeoutDuration = isNaN(vswcMicListenAutoTimeoutDuration) ? 8 : vswcMicListenAutoTimeoutDuration;
        } else {
            vswcMicListenAutoTimeoutDuration = 8;
        }

        vswcMicListenAutoTimeoutDuration = (vswcMicListenAutoTimeoutDuration < 8) ? 8 : vswcMicListenAutoTimeoutDuration;
        vswcMicListenAutoTimeoutDuration = (vswcMicListenAutoTimeoutDuration > 20) ? 20 : vswcMicListenAutoTimeoutDuration;
        vswcMicListenAutoTimeoutDuration = vswcMicListenAutoTimeoutDuration * 1000;

        // Function to clear mic reset timeout
        function vswcClearMicResetTimeout() {
            try {
                if (window.vswcMicTimeoutIdentifier) {
                    clearTimeout(window.vswcMicTimeoutIdentifier);
                    window.vswcMicTimeoutIdentifier = null;
                }
            } catch (err) {
                // Do nothing for now
            }
        }

        // sanitize alpha-numeric css values to get numeric value
        function getNumber(number) {
            number = parseInt(number, 10);
            return isNaN(number) || number === null || typeof (number) === 'undefined' ? 0 : number;
        }

        // Function to check if any mic already listening
        function vswcAnyOtherMicListening(vswcExceptionBtnId = null) {
            var vswcOneOfMicListening = false;
            try {
                var vswcAllMicButtons = document.querySelectorAll('button.voice-search-for-woocommerce-button');

                if (typeof (vswcAllMicButtons) == 'undefined'
                    || vswcAllMicButtons === null
                    || vswcExceptionBtnId == null) { return vswcOneOfMicListening; }

                for (var vswcI = 0; vswcI < vswcAllMicButtons.length; vswcI++) {
                    var vswcClassNames = vswcAllMicButtons[vswcI].className;
                    var vswcBtnId = vswcAllMicButtons[vswcI].getAttribute('id');

                    if (!(typeof (vswcClassNames) != 'undefined' && vswcClassNames.trim() != '')) continue;

                    if (vswcClassNames.indexOf('listening') != -1 && vswcExceptionBtnId != vswcBtnId) {
                        vswcOneOfMicListening = true;
                        break;
                    }
                }
            } catch (err) {
                vswcOneOfMicListening = false;
            }

            return vswcOneOfMicListening;
        }

        // Clear any pre-existing timeouts
        vswcClearMicResetTimeout();

        var inputWrapperSelectorsToSeek = [
            'form[role=search]',
            'form[class=searchform]',
            'form[class=search_form]',
            'form[class=search-form]',
            'form[class=searchForm]'
        ];
        var searchInputSelectorsToSeek = [
            'input[name=s]',
            'input[name=search]',
            'input[name=find]',
            'input[type=search]',
            'input[class=search-field]',
            'input[class=search_field]',
            'input[class=searchfield]',
            'input[class=searchField]',
            'input[id=search]',
            'input[id=search-field]',
            'input[id=search_field]',
            'input[id=searchfield]',
            'input[id=searchField]'
        ];

        var vswcMicEventToListen = 'click';

        // Detect Android OS
        var ua = navigator.userAgent.toLowerCase();
        var isAndroid = ua.indexOf("android") > -1;

        var recordTimer = null;

        var vswcAllFormsOnPage = document.querySelectorAll('form');// Get all forms on a page
        var speechInputWrappers = [];

        // Seek and get forms with search ability
        try {
            for (var vdnI = 0; vdnI < inputWrapperSelectorsToSeek.length; vdnI++) {
                speechInputWrappers = document.querySelectorAll(inputWrapperSelectorsToSeek[vdnI]);

                if (speechInputWrappers.length > 0) { break; }
            }
        } catch (err) { speechInputWrappers = []; }

        // Override 'speechInputWrappers' to cover missing forms from page
        if (speechInputWrappers.length < vswcAllFormsOnPage.length) {
            speechInputWrappers = null;
            speechInputWrappers = vswcAllFormsOnPage;
        }

        let formElementForWidget = null;

        [].forEach.call(speechInputWrappers, function (speechInputWrapper, index) {
            var inputEl = null;
            var recognizing = false;

            try {
                // Preserve first form on page and it's input element for widget
                if (index == 0) {
                    formElementForWidget = speechInputWrapper;
                }

                // Get input field intented for search feature on page
                for (var vswcI = 0; vswcI < searchInputSelectorsToSeek.length; vswcI++) {
                    inputEl = speechInputWrapper.querySelector(searchInputSelectorsToSeek[vswcI]);

                    if (inputEl !== null) { break; }
                }

                // Get submit button
                let formSubmitBtnEl = speechInputWrapper.querySelector("input[type=submit]");

                if (formSubmitBtnEl === null) {
                    formSubmitBtnEl = speechInputWrapper.querySelector("button[type=submit]");
                }

                if (formSubmitBtnEl !== null) {
                    speechInputWrapper.addEventListener('submit', function (submitEvent) {
                        // If mic is listening then abort form submition
                        if (recognizing == true) {
                            submitEvent.preventDefault();
                        }
                    }, false);

                    // Remove any overlapping icon from submit button of search form                   
                    try {
                        let submitButtonChildNodes = formSubmitBtnEl.querySelectorAll('img, svg');

                        for (let j = 0; j < submitButtonChildNodes.length; j++) {
                            let submitBtnChildNode = submitButtonChildNodes[j];
                            submitBtnChildNode.classList.add('vswc-hide-element');
                        }
                    } catch (err) {
                        // do nothing for now
                    }
                }
            } catch (err) { inputEl = null; }

            // If search input field not found then continue
            if (null === inputEl) { return; }

            try {
                // Try to show the form temporarily so we can calculate the sizes
                var speechInputWrapperStyle = speechInputWrapper.getAttribute('style');
                var havingInlineStyle = (typeof (speechInputWrapperStyle) != 'undefined'
                    && speechInputWrapperStyle !== null && speechInputWrapperStyle.trim() != '') ? true : false;
                speechInputWrapperStyle = (havingInlineStyle) ? speechInputWrapperStyle + ';' : '';
                speechInputWrapper.setAttribute('style', speechInputWrapperStyle + 'display: block !important');
                //speechInputWrapper.classList.add('voice-search-for-woocommerce-wrapper');
                speechInputWrapper.classList.add('vswc-sanitize-form-wrapper');

                // Add some markup as a button to the search form
                var micBtn = document.createElement('button');
                micBtn.setAttribute('type', 'button');
                micBtn.setAttribute('class', 'voice-search-for-woocommerce-button');
                micBtn.setAttribute('id', 'voice-search-for-woocommerce-button' + index);
                micBtn.appendChild(document.createTextNode(voice_search_for_woocommerce.button_message));

                // Add mic image icon
                var vswcMicIcon = document.createElement('img');
                vswcMicIcon.setAttribute('src', vswc.vswcImagesPath + 'vswc_mic.svg');
                vswcMicIcon.setAttribute('class', 'vswc-mic-image');

                micBtn.appendChild(vswcMicIcon);

                var inputHeight = getNumber(inputEl.offsetHeight);// Get search input height
                var buttonSize = getNumber(0.8 * inputHeight);

                // Set default mic button size to 35px when button size calculated to 0 or unknown
                if (getNumber(buttonSize) == 0) { inputHeight = buttonSize = 35; }

                var micbtnPositionTop = getNumber(0.1 * inputHeight);

                // Size and position of complete mic button
                var inlineStyle = 'top: ' + micbtnPositionTop + 'px; ';
                inlineStyle += 'height: ' + buttonSize + 'px !important; ';
                inlineStyle += 'width: ' + buttonSize + 'px !important; ';
                inlineStyle += 'z-index: 999 !important; margin-left: 3px !important; border-radius: 50% !important;  border: 2px solid #ffff !important;';
                micBtn.setAttribute('style', inlineStyle);

                // Create Wrapper to wrap around input search field like a elastic band
                var wrapper = document.createElement('div');
                wrapper.setAttribute('style', speechInputWrapperStyle + 'display: inline-block !important');
                let inputCurrentStyle = window.getComputedStyle(inputEl);
                wrapper.setAttribute('class', 'vswc-mic-band');
                wrapper.setAttribute('onclick', 'return false');
                wrapper.style.width = inputCurrentStyle.width;
                inputEl.insertAdjacentElement('beforebegin', wrapper);// Place wrapper before input search field

                // Set parent element's (parent of inputEl) display stack order higher 
                // To handle overlapped submit button on mic icon
                var parentEl = inputEl.parentNode.nodeName;

                if (typeof (parentEl) != 'undefined' && parentEl !== null && parentEl.length != 0) {
                    parentEl = parentEl.toLowerCase();

                    if (parentEl != 'form') {
                        inputEl.parentNode.style.zIndex = 1;
                    }
                }

                // Append search input field element inside a wrapper band
                wrapper.appendChild(inputEl);

                // Place mic button/icon exact before search input field element
                inputEl.insertAdjacentElement('beforebegin', micBtn);
                inputEl.setAttribute('style', speechInputWrapperStyle + 'width: 100% !important;');
                inputEl.classList.add('vswc-mic-band');

                // Reset form style again
                speechInputWrapper.setAttribute('style', speechInputWrapperStyle);

                // Setup recognition
                var finalTranscript = '';
                var final_transcript = "";
                var ignore_onend;

                if ('webkitSpeechRecognition' in window && vswcClientInfo['chrome'] === true) {
                    var recognition = new webkitSpeechRecognition();
                    recognition.continuous = true;
                    recognition.interimResults = true;

                    recognition.onstart = function () {
                        recognizing = true;
                    };

                    recognition.onerror = function (event) {
                        micBtn.classList.remove('listening');
                        recognizing = false;

                        if (event.error == 'no-speech') {
                            inputEl.placeholder = vswcMessages['unableToHear'];

                            // Play 'notAudible' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                            vswcAudioPlayer.play();

                            ignore_onend = true;
                        }
                        if (event.error == 'audio-capture') {
                            // Play 'micConnect' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                            vswcAudioPlayer.play();

                            inputEl.placeholder = vswcMessages['micNotAccessible'];
                            ignore_onend = true;
                        }
                        if (event.error == 'not-allowed') {
                            // Play 'micConnect' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                            vswcAudioPlayer.play();

                            inputEl.placeholder = vswcMessages['browserDenyMicAccess'];
                            micBtn.style.setProperty("color", "white");
                            ignore_onend = true;
                        }
                    };

                    function processEnd() {
                        recognizing = false;

                        if (ignore_onend) { return; }

                        finalTranscript = final_transcript;
                        micBtn.classList.remove('listening');
                        micBtn.style.setProperty("color", "white");

                        if (typeof (finalTranscript) != 'undefined' && finalTranscript.length != 0) {
                            inputEl.value = final_transcript;

                            // Play 'basic' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () { speechInputWrapper.submit(); });
                            vswcAudioPlayer.play();
                        } else {
                            inputEl.placeholder = vswcMessages['ask'];
                        }
                    };

                    recognition.onend = function () {
                        if (isAndroid) {
                            processEnd();
                        }
                    };

                    recognition.onresult = function (event) {
                        let interim_transcript = '';

                        if (typeof (event.results) == 'undefined') {
                            recognition.onend = null;
                            recognition.stop();
                            inputEl.placeholder = vswcMessages['unableToHear'];

                            // Play 'micConnect' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                            vswcAudioPlayer.play();

                            return;
                        }

                        for (var i = event.resultIndex; i < event.results.length; ++i) {
                            if (event.results[i].isFinal) {
                                final_transcript = event.results[i][0].transcript;

                                if (isAndroid == false) {
                                    processEnd();
                                    recognition.stop();
                                }
                            } else {
                                interim_transcript += event.results[i][0].transcript;
                                inputEl.value = interim_transcript;
                            }
                        }
                    };

                    micBtn.addEventListener(vswcMicEventToListen, function (event) {
                        // micBtn.onclick = function (event) {
                        if (vswcAnyOtherMicListening(micBtn.getAttribute('id')) === true) return;

                        if (recognizing) {
                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            if (isAndroid == false) {
                                processEnd();
                                recognition.stop();
                            }
                        } else {
                            micBtn.classList.add('listening');
                            event.preventDefault();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            inputEl.value = finalTranscript = '';
                            recognizing = true;
                            recognition.lang = !!vswcSttLanguageContext['gcp']['stt'] ? vswcSttLanguageContext['gcp']['langCode'] : 'en-US';;
                            recognition.start();
                            ignore_onend = false;

                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // To set new mic reset timeout. (Based on duration from settings)
                            window.vswcMicTimeoutIdentifier = setTimeout(function () {
                                let updatedClassList = micBtn.classList;

                                if (updatedClassList && updatedClassList.contains('listening')) {
                                    micBtn.click();
                                }
                            }, vswcMicListenAutoTimeoutDuration);
                        }
                    });
                } else {
                    //CODE FOR BROWSERS THAT DO NOT SUPPORT STT NATIVLY
                    // MUST USE THE BUILT IN MICROPHONE
                    micBtn.addEventListener(vswcMicEventToListen, function (event) {
                        /**
                         * Audio element's play method must be invoked in exact influence of user gesture to avoid auto play restriction
                         * 
                         */
                        if (
                            vswcClientInfo.ios === true
                            || (vswcClientInfo.iosSafari && !vswcClientInfo.chrome && !vswcClientInfo.firefox)
                            || (vswcClientInfo.windows && vswcClientInfo.firefox)
                        ) {
                            vswcAudioPlayer.configure(vswcSilenceSoundPath);
                            vswcAudioPlayer.play();
                        }

                        if (vswcAnyOtherMicListening(micBtn.getAttribute('id')) === true) return;

                        // Deny recording if microphone is not accessible
                        if (!vswcAudioRecorder || !vswcAudioContext) {
                            vswcInitAudio(function (a) {
                                if (!vswcAudioRecorder || !vswcAudioContext) {
                                    alert(vswcMessages['cantAccessMicrophone']);
                                    return false;
                                } else {
                                    listenEvent();
                                }
                            });
                        } else {
                            listenEvent();
                        }

                        function listenEvent() {
                            // If API system key is unavailable then acknowledge service unavailability and stop voice navigation.
                            if (!(typeof (vswc.vswcXApiKey) != 'undefined' && vswc.vswcXApiKey !== null)) {
                                // Play 'unavailable' playback
                                vswcAudioPlayer.configure(vswcAlternativeResponse['unavailable']);
                                vswcAudioPlayer.play();
                                return false;
                            }

                            // User ending recording by clicking back mic
                            if (recognizing) {
                                // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                                vswcClearMicResetTimeout();

                                // Stop recorder
                                vswcAudioRecorder.stop();

                                // Stop access to audio resource
                                vswcStopAudio();

                                // Stop ongoing playback if nay
                                if (vswcAudioPlayer.isPlaying()) {
                                    vswcAudioPlayer.stop();
                                }

                                //replace recording with mic icon
                                micBtn.classList.remove('listening');

                                micBtn.style.setProperty("color", "white");
                                inputEl.placeholder = vswcMessages['transcribeText'];

                                vswcAudioRecorder.getBuffers(function (buffers) {
                                    if (!!vswcSttLanguageContext['gcp']['stt']) {
                                        vswcAudioRecorder.exportMonoWAV(function (blob) {
                                            vswcAudioRecorder.convertBlobToBase64(blob).then(function (resultedBase64) {
                                                vswcGcpStt(resultedBase64).then(function (transcriptResult) {
                                                    inputEl.value = transcriptResult;

                                                    // Play 'basic' playback
                                                    vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () {
                                                        speechInputWrapper.submit();
                                                    });
                                                    vswcAudioPlayer.play();
                                                }).catch(function (error) {
                                                    // Play 'notAudible' playback
                                                    vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                                    vswcAudioPlayer.play();

                                                    inputEl.placeholder = vswcMessages['ask'];
                                                })
                                            }).catch(function (error) {
                                                // Play 'notAudible' playback
                                                vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                                vswcAudioPlayer.play();

                                                inputEl.placeholder = vswcMessages['ask'];
                                            });
                                        });
                                    } else {
                                        // Play 'notAudible' playback
                                        vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                        vswcAudioPlayer.play();

                                        inputEl.placeholder = vswcMessages['ask'];
                                    }
                                });

                                recognizing = false;
                                return;

                            } else {// User started recording by clicking mic
                                micBtn.classList.add('listening');
                                event.preventDefault();

                                // Stop ongoing playback if nay
                                if (vswcAudioPlayer.isPlaying()) {
                                    vswcAudioPlayer.stop();
                                }

                                inputEl.value = finalTranscript = '';

                                recognizing = true;
                                vswcAudioRecorder.clear();
                                vswcAudioRecorder.record(micBtn);

                                // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                                vswcClearMicResetTimeout();

                                // To set new mic reset timeout. (Based on duration from settings)
                                window.vswcMicTimeoutIdentifier = setTimeout(function () {
                                    let updatedClassList = micBtn.classList;

                                    if (updatedClassList && updatedClassList.contains('listening')) {
                                        micBtn.click();
                                    }
                                }, vswcMicListenAutoTimeoutDuration);
                            }
                        }
                    }, false);
                }
            } catch (err) {  /* do nothing */ }
        });

        // Load floating mic with search bar
        //############################# Floating mic - Widget ###################################
        let vswcDocFragment = document.createDocumentFragment();
        // Create root/widget wrapper
        let vswcWidgetWrapper = document.createElement('div');

        let vswcWrapperMicPositionClass = 'vswc-widget-wrapper-middle-right';
        let vswcChatWrapperMicPositionClass = 'vswc-widget-chat-wrapper-middle-right';
        let vswcMicPosition = vswc.vswcSelectedMicPosition ? vswc.vswcSelectedMicPosition.toLowerCase() : 'middle right';

        switch (vswcMicPosition) {
            case 'middle left':
                vswcWrapperMicPositionClass = 'vswc-widget-wrapper-middle-left';
                vswcChatWrapperMicPositionClass = 'vswc-widget-chat-wrapper-middle-left';
                break;
            case 'top right':
                vswcWrapperMicPositionClass = 'vswc-widget-wrapper-top-right';
                vswcChatWrapperMicPositionClass = 'vswc-widget-chat-wrapper-top-right';
                break;
            case 'top left':
                vswcWrapperMicPositionClass = 'vswc-widget-wrapper-top-left';
                vswcChatWrapperMicPositionClass = 'vswc-widget-chat-wrapper-top-left';
                break;
            case 'bottom right':
                vswcWrapperMicPositionClass = 'vswc-widget-wrapper-bottom-right';
                vswcChatWrapperMicPositionClass = 'vswc-widget-chat-wrapper-bottom-right';
                break;
            case 'bottom left':
                vswcWrapperMicPositionClass = 'vswc-widget-wrapper-bottom-left';
                vswcChatWrapperMicPositionClass = 'vswc-widget-chat-wrapper-bottom-left';
                break;
            default:
                vswcWrapperMicPositionClass = 'vswc-widget-wrapper-middle-right';
                vswcChatWrapperMicPositionClass = 'vswc-widget-chat-wrapper-middle-right';
        }

        vswcWidgetWrapper.setAttribute('class', 'vswc-widget-wrapper ' + vswcWrapperMicPositionClass + '');

        // Create chat wrapper
        let vswcWidgetChatWrapper = document.createElement('div');
        vswcWidgetChatWrapper.setAttribute('class', 'vswc-widget-chat-wrapper ' + vswcChatWrapperMicPositionClass + '');

        // ############################ Widget Fields (Input section) ############################
        // Create widget text field and mic (Input Section)
        let vswcWidgetField = document.createElement('div');
        vswcWidgetField.setAttribute('class', 'vswc-widget-field');

        // Create mic icon wrapper
        let vswcWidgetMic = document.createElement('a');
        vswcWidgetMic.setAttribute('id', 'vswcWidgetMic');
        vswcWidgetMic.setAttribute('class', 'vswc-widget-button');

        // Create and append mic icon/image to mic wrapper
        let vswcWidgetMicImg = document.createElement('img');
        vswcWidgetMicImg.setAttribute('src', vswc.vswcImagesPath + 'vswc-widget-mic-black.svg');
        vswcWidgetMic.appendChild(vswcWidgetMicImg);

        // Create button wrapper next to input text field
        let vswcWidgetSearchBtn = document.createElement('a');
        vswcWidgetSearchBtn.setAttribute('id', 'vswcWidgetSearchBtn');

        // Create and append search button to button wrapper
        let vswcWidgetSearchBtnEl = document.createElement('button');
        vswcWidgetSearchBtnEl.setAttribute('class', 'vswc-widget-form-submit-btn');
        vswcWidgetSearchBtnEl.setAttribute('type', 'submit');
        vswcWidgetSearchBtnEl.setAttribute('alt', 'Go');
        vswcWidgetSearchBtnEl.setAttribute('title', 'Search');

        vswcWidgetSearchBtn.appendChild(vswcWidgetSearchBtnEl);

        // Create form for widget
        let vswcWidgetForm = document.createElement('form');
        vswcWidgetForm.setAttribute("class", "vswc-widget-form");

        if (formElementForWidget !== null) {
            vswcWidgetForm.action = formElementForWidget.action;
            vswcWidgetForm.method = formElementForWidget.method;
        } else {
            vswcWidgetForm.action = vswcGetCurrentHostURL() + '/';
            vswcWidgetForm.method = "get";
        }

        // Create input text field 
        let vswcWidgetSearch = document.createElement('input');
        vswcWidgetSearch.setAttribute('id', 'vswcWidgetSearch');
        vswcWidgetSearch.setAttribute('class', 'vswc-widget-search vswc-widget-search-text');
        vswcWidgetSearch.setAttribute('name', 'vswc-widget-search');
        vswcWidgetSearch.setAttribute('placeholder', vswcWidgetMessages['placeholder']);
        vswcWidgetSearch.setAttribute('name', 's');

        // Create WooCommerce appendix
        let vswcWidgetWooSearch = document.createElement('input');
        vswcWidgetWooSearch.setAttribute('type', 'hidden');
        vswcWidgetWooSearch.setAttribute('name', 'post_type');
        vswcWidgetWooSearch.setAttribute('value', 'product');

        vswcWidgetForm.appendChild(vswcWidgetSearch);
        vswcWidgetForm.appendChild(vswcWidgetWooSearch);
        vswcWidgetForm.appendChild(vswcWidgetSearchBtn);

        // Append mic and form to widget field section (input section)
        vswcWidgetField.appendChild(vswcWidgetMic);
        vswcWidgetField.appendChild(vswcWidgetForm);

        // Append chat header, chat conversation and input fields to widget chat wrapper
        vswcWidgetChatWrapper.appendChild(vswcWidgetField);

        // ################################ Widget Toggle button #########################
        // Create a widget toggle button wrapper
        let vswcWidgetToggleButton = document.createElement('a');


        // Create toggle button icon element
        let vswcWidgetIcon = document.createElement('div');

        // Create a pulse effect it's show when user trigger stt
        let vswcWidgetPulseEffect = document.createElement('span');
        vswcWidgetPulseEffect.setAttribute('id', 'vswcWidgetPulseEffect');

        if (vswc.vswcFloatingMic && vswc.vswcFloatingMic === 'yes') {
            vswcWidgetToggleButton.setAttribute('id', 'vswcWidgetToggleButton');
            vswcWidgetToggleButton.setAttribute('class', 'vswc-widget-button');
            vswcWidgetIcon.setAttribute('class', 'vswc-widget-icon vswc-widget-toggle-button vswc-toggle-btn-mic');
            // Append toggle button icon to toggle button wrapper
            vswcWidgetToggleButton.appendChild(vswcWidgetIcon);
        }

        // Append chat wrapper and toggle button to widget wrapper
        vswcWidgetWrapper.appendChild(vswcWidgetChatWrapper)
        vswcWidgetWrapper.appendChild(vswcWidgetPulseEffect)
        vswcWidgetWrapper.appendChild(vswcWidgetToggleButton);

        // Append widget to body
        vswcDocFragment.appendChild(vswcWidgetWrapper);
        document.body.appendChild(vswcDocFragment);

        // Listen event to show/hide widget
        vswcWidgetToggleButton.addEventListener('click', function (event) {
            vswcToggleWidgetElements();
        });

        /*############################# Widget mic handling ################################*/
        // Setup recognition
        let widgetFinalTranscript = '';
        let widgetRecognizing = false;
        let widget_final_transcript = "";
        let widget_ignore_onend;

        /**
         * Function for add pulse animation in elementor mic
         *
         */
        function vswcElementorMicPulseAnimation(vswcElementorMicElement) {
            let size = 0, left = 0;
            if (vswcElementorMicElement.clientHeight >= 80) {
                size = vswcElementorMicElement.clientHeight + 15;
                left = -(size / 6);
            } if (vswcElementorMicElement.clientHeight >= 60) {
                size = vswcElementorMicElement.clientHeight + 12;
                left = -(size / 5);
            } else if (vswcElementorMicElement.clientHeight >= 30) {
                size = vswcElementorMicElement.clientHeight + 10;
                left = -(size / 4);
            } else {
                size = vswcElementorMicElement.clientHeight + 8;
                left = -(size / 3.5);
            }


            const vswcPulse = document.createElement('div');
            vswcPulse.setAttribute('id', 'pulse');
            vswcPulse.setAttribute('class', 'pulse-color');
            vswcPulse.style.width = size + 'px';
            vswcPulse.style.height = size + 'px';
            vswcPulse.style.left = left + 'px';

            const vswcPulseRate = document.createElement('div');
            vswcPulseRate.setAttribute('id', 'pulse-rate');
            vswcPulseRate.setAttribute('class', 'pulse-color');
            vswcPulseRate.style.width = size + 'px';
            vswcPulseRate.style.height = size + 'px';
            vswcPulseRate.style.left = left + 'px';

            return { vswcPulse, vswcPulseRate };
        }

        function enableElementor() {
            const vswcFloatigMic = document.getElementById('flt-mic')
            if (vswcFloatigMic != null) {
                const vswcElementorMicColor = vswcFloatigMic.getElementsByClassName('my-icon-wrapper')[0].getElementsByTagName('i')[0];
                const vswcPulseItem = vswcElementorMicPulseAnimation(vswcElementorMicColor);
                if ('webkitSpeechRecognition' in window && vswcClientInfo['chrome'] === true) {
                    let widgetRecognition = new webkitSpeechRecognition();
                    widgetRecognition.continuous = true;
                    widgetRecognition.interimResults = true;

                    widgetRecognition.onstart = function () {
                        widgetRecognizing = true;
                    };

                    widgetRecognition.onerror = function (event) {
                        vswcFloatigMic.classList.remove('listening');
                        widgetRecognizing = false;
                        vswcElementorMicColor.classList.remove('my-icon-animation-wrapper');
                        vswcElementorMicColor.removeChild(vswcPulseItem['vswcPulse']);
                        vswcElementorMicColor.removeChild(vswcPulseItem['vswcPulseRate']);

                        if (event.error == 'no-speech') {
                            // Play feature unavailable playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                            vswcAudioPlayer.play();

                            widget_ignore_onend = true;
                        }

                        if (event.error == 'audio-capture') {
                            // Play 'micConnect' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                            vswcAudioPlayer.play();

                            widget_ignore_onend = true;
                            vswcWidgetSearch.placeholder = vswcMessages['micNotAccessible'];
                        }

                        if (event.error == 'not-allowed') {
                            // Play 'micConnect' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                            vswcAudioPlayer.play();

                            widget_ignore_onend = true;
                            vswcWidgetSearch.placeholder = vswcMessages['browserDenyMicAccess'];

                        }
                    };

                    function widgetProcessEnd() {
                        widgetRecognizing = false;

                        if (widget_ignore_onend) { return; }

                        widgetFinalTranscript = widget_final_transcript;
                        vswcFloatigMic.classList.remove('listening');
                        vswcElementorMicColor.classList.remove('my-icon-animation-wrapper');
                        vswcElementorMicColor.removeChild(vswcPulseItem['vswcPulse']);
                        vswcElementorMicColor.removeChild(vswcPulseItem['vswcPulseRate']);


                        if (typeof (widgetFinalTranscript) != 'undefined' && widgetFinalTranscript.length != 0) {
                            vswcWidgetSearch.value = widgetFinalTranscript;

                            // Play 'basic' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () {
                            });
                            vswcAudioPlayer.play();
                            setTimeout(() => {
                                vswcWidgetForm.submit();
                            }, 2000);
                        } else {
                            // Play 'notAudible' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                            vswcAudioPlayer.play();

                            vswcWidgetSearch.placeholder = vswcMessages['ask'];
                        }
                    }

                    widgetRecognition.onend = function () {
                        if (isAndroid) { widgetProcessEnd(); }
                    };

                    widgetRecognition.onresult = function (event) {
                        let interim_transcript = '';
                        if (typeof (event.results) == 'undefined') {
                            widgetRecognition.onend = null;
                            widgetRecognition.stop();

                            // Play 'micConnect' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                            vswcAudioPlayer.play();
                            return;
                        }

                        let eventResultsLength = event.results.length;

                        for (let i = event.resultIndex; i < eventResultsLength; ++i) {
                            if (event.results[i].isFinal) {
                                widget_final_transcript = event.results[i][0].transcript;

                                if (isAndroid == false) {
                                    widgetProcessEnd();
                                    widgetRecognition.stop();
                                }
                            } else {
                                interim_transcript += event.results[i][0].transcript;
                            }
                        }
                    };
                    vswcFloatigMic.addEventListener(vswcMicEventToListen, function (event) {

                        if (vswcAnyOtherMicListening(vswcFloatigMic.getAttribute('id'), vswcFloatigMic) === true) return;

                        if (widgetRecognizing) {
                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            if (isAndroid == false) {
                                widgetProcessEnd();
                                widgetRecognition.stop();
                            }
                        } else {
                            vswcFloatigMic.classList.add('listening');
                            vswcElementorMicColor.classList.add('my-icon-animation-wrapper');
                            vswcElementorMicColor.appendChild(vswcPulseItem['vswcPulse']);
                            vswcElementorMicColor.appendChild(vswcPulseItem['vswcPulseRate']);
                            event.preventDefault();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            widgetFinalTranscript = '';
                            widgetRecognizing = true;
                            widgetRecognition.lang = !!vswcSttLanguageContext['gcp']['stt'] ? vswcSttLanguageContext['gcp']['langCode'] : 'en-US';
                            widgetRecognition.start();
                            widget_ignore_onend = false;

                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // To set new mic reset timeout. (Based on duration from settings)
                            window.vswcMicTimeoutIdentifier = setTimeout(function () {
                                let updatedClassList = vswcFloatigMic.classList;

                                if (updatedClassList && updatedClassList.contains('listening')) {
                                    vswcFloatigMic.click();
                                }
                            }, vswcMicListenAutoTimeoutDuration);
                        }
                    });
                } else {
                    //CODE FOR BROWSERS THAT DO NOT SUPPORT STT NATIVLY
                    // MUST USE THE BUILT IN MICROPHONE
                    vswcFloatigMic.addEventListener(vswcMicEventToListen, function (event) {

                        /**
                         * Audio element's play method must be invoked in exact influence of user gesture to avoid auto play restriction
                         * 
                         */
                        if (
                            vswcClientInfo.ios === true
                            || (vswcClientInfo.iosSafari && !vswcClientInfo.chrome && !vswcClientInfo.firefox)
                            || (vswcClientInfo.windows && vswcClientInfo.firefox)
                        ) {
                            vswcAudioPlayer.configure(vswcSilenceSoundPath);
                            vswcAudioPlayer.play();
                        }

                        if (vswcAnyOtherMicListening(vswcFloatigMic.getAttribute('id'), vswcFloatigMic) === true) return;

                        // Deny recording if microphone is not accessible
                        if (!vswcAudioRecorder || !vswcAudioContext) {
                            vswcInitAudio(function (a) {
                                if (!vswcAudioRecorder || !vswcAudioContext) {
                                    vswcWidgetSearch.placeholder = vswcMessages['micNotAccessible'];
                                    return false;
                                } else {
                                    widgetListenEvent();
                                }
                            });
                        } else {
                            widgetListenEvent();
                        }

                        function widgetListenEvent() {
                            // If API system key is unavailable then acknowledge service unavailability and stop voice navigation.
                            if (!(typeof (vswc.vswcXApiKey) != 'undefined' && vswc.vswcXApiKey !== null)) {
                                // Play 'unavailable' playback
                                vswcAudioPlayer.configure(vswcAlternativeResponse['unavailable']);
                                vswcAudioPlayer.play();

                                return false;
                            }

                            // User ending recording by clicking back mic
                            if (widgetRecognizing) {
                                // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                                vswcClearMicResetTimeout();

                                // Stop recorder
                                vswcAudioRecorder.stop();

                                // Stop access to audio resource
                                vswcStopAudio();

                                // Stop ongoing playback if nay
                                if (vswcAudioPlayer.isPlaying()) {
                                    vswcAudioPlayer.stop();
                                }

                                //replace recording with mic icon
                                vswcFloatigMic.classList.remove('listening');
                                vswcElementorMicColor.classList.remove('my-icon-animation-wrapper');
                                vswcElementorMicColor.removeChild(vswcPulseItem['vswcPulse']);
                                vswcElementorMicColor.removeChild(vswcPulseItem['vswcPulseRate']);

                                vswcWidgetSearch.placeholder = vswcMessages['transcribeText'];

                                vswcAudioRecorder.getBuffers(function (buffers) {
                                    if (!!vswcSttLanguageContext['gcp']['stt']) {
                                        vswcAudioRecorder.exportMonoWAV(function (blob) {
                                            vswcAudioRecorder.convertBlobToBase64(blob).then(function (resultedBase64) {
                                                vswcGcpStt(resultedBase64).then(function (transcriptResult) {
                                                    vswcWidgetSearch.value = transcriptResult;

                                                    // Play 'basic' playback
                                                    vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () {
                                                    });
                                                    vswcAudioPlayer.play();
                                                    setTimeout(() => {
                                                        vswcWidgetForm.submit();
                                                    }, 2000);
                                                }).catch(function (error) {
                                                    // Play 'notAudible' playback
                                                    vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                                    vswcAudioPlayer.play();

                                                    vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                                })
                                            }).catch(function (error) {
                                                // Play 'notAudible' playback
                                                vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                                vswcAudioPlayer.play();

                                                vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                            });
                                        });
                                    } else {
                                        // Play 'notAudible' playback
                                        vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                        vswcAudioPlayer.play();
                                        vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                    }
                                });

                                widgetRecognizing = false;
                                return;
                            } else {// User started recording by clicking mic
                                vswcFloatigMic.classList.add('listening');
                                vswcElementorMicColor.classList.add('my-icon-animation-wrapper');
                                vswcElementorMicColor.appendChild(vswcPulseItem['vswcPulse']);
                                vswcElementorMicColor.appendChild(vswcPulseItem['vswcPulseRate']);
                                event.preventDefault();

                                // Stop ongoing playback if nay
                                if (vswcAudioPlayer.isPlaying()) {
                                    vswcAudioPlayer.stop();
                                }

                                widgetFinalTranscript = '';

                                widgetRecognizing = true;
                                vswcAudioRecorder.clear();
                                vswcAudioRecorder.record(vswcFloatigMic);

                                // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                                vswcClearMicResetTimeout();

                                // To set new mic reset timeout. (Based on duration from settings)
                                window.vswcMicTimeoutIdentifier = setTimeout(function () {
                                    let updatedClassList = vswcFloatigMic.classList;

                                    if (updatedClassList && updatedClassList.contains('listening')) {
                                        vswcFloatigMic.click();
                                    }
                                }, vswcMicListenAutoTimeoutDuration);
                            }
                        }
                    }, false);
                }
            }
        }

        /**
         * Function for provide simplicity to interct with floating mic using keyboard key between a-z
         * 
         * @param clickType: single or double
         */
        function vswcFloatingMicKeyBoardAccess(clickType) {
            if (vswc.vswcFloatingMic && vswc.vswcFloatingMic === 'yes') {
                var keyFormSetting = vswc.vswcKeyboardSpecialKey == 'OtherKey' ? vswc.vswcKeyboardMicSwitch : vswc.vswcKeyboardSpecialKey == 'Space' ? ' ' : vswc.vswcKeyboardSpecialKey;
                var spaceCount = 0;
                window.addEventListener('keydown', (event) => {
                    let target = event.target;

                    // Check if the event originated from an input field
                    if (target.tagName === 'INPUT') {
                        // Ignore keyboard events on input fields
                        return;
                    }

                    if (event.key == keyFormSetting) {
                        spaceCount++;
                        event.preventDefault();
                        if (spaceCount == 2) {
                            if (clickType == 'single') {
                                vswcWidgetToggleButton.click();
                            } else if (clickType == 'double') {
                                if (vswcWidgetChatWrapper.classList.contains('vswc-widget-visible')) {
                                    vswcWidgetMic.click();
                                } else {
                                    vswcWidgetToggleButton.click();
                                    vswcWidgetMic.click();
                                }
                            }
                            spaceCount = 0;
                        }
                    }
                });
            }
        }

        /**
         * Function for made a indication on single click
         * 
         * @param action: add for add indication , remove for remove indication
         */
        function vswcSingleClickMicEffect(action) {
            if (action == 'add') {
                vswcWidgetToggleButton.classList.add('listening');
                vswcWidgetToggleButton.classList.add('singleClick');
                vswcWidgetPulseEffect.classList.add('singleClick');
            } else if (action == 'remove') {
                vswcWidgetToggleButton.classList.remove('listening');
                vswcWidgetToggleButton.classList.remove('singleClick');
                vswcWidgetPulseEffect.classList.remove('singleClick');
            }
        }

        function enableSingleClick() {
            vswcWidgetWrapper.classList.remove('vswcWidgetChatWrapper');
            if ('webkitSpeechRecognition' in window && vswcClientInfo['chrome'] === true) {
                let widgetRecognition = new webkitSpeechRecognition();
                widgetRecognition.continuous = true;
                widgetRecognition.interimResults = true;

                widgetRecognition.onstart = function () {
                    widgetRecognizing = true;
                };

                widgetRecognition.onerror = function (event) {
                    vswcSingleClickMicEffect('remove');
                    widgetRecognizing = false;

                    if (event.error == 'no-speech') {
                        // Play feature unavailable playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                        vswcAudioPlayer.play();

                        widget_ignore_onend = true;
                        vswcWidgetSearch.placeholder = vswcMessages['unableToHear'];
                    }

                    if (event.error == 'audio-capture') {
                        // Play 'micConnect' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                        vswcAudioPlayer.play();

                        widget_ignore_onend = true;
                        vswcWidgetSearch.placeholder = vswcMessages['micNotAccessible'];
                    }

                    if (event.error == 'not-allowed') {
                        // Play 'micConnect' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                        vswcAudioPlayer.play();

                        widget_ignore_onend = true;
                        vswcWidgetSearch.placeholder = vswcMessages['browserDenyMicAccess'];
                    }
                };

                function widgetProcessEnd() {
                    widgetRecognizing = false;

                    if (widget_ignore_onend) { return; }

                    widgetFinalTranscript = widget_final_transcript;
                    vswcSingleClickMicEffect('remove');

                    if (typeof (widgetFinalTranscript) != 'undefined' && widgetFinalTranscript.length != 0) {
                        vswcWidgetSearch.value = widgetFinalTranscript;

                        // Play 'basic' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () {
                        });
                        vswcAudioPlayer.play();
                        setTimeout(() => {
                            vswcWidgetForm.submit();
                        }, 2000);
                    } else {
                        // Play 'notAudible' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                        vswcAudioPlayer.play();

                        vswcWidgetSearch.placeholder = vswcMessages['ask'];
                    }
                }

                widgetRecognition.onend = function () {
                    if (isAndroid) { widgetProcessEnd(); }
                };

                widgetRecognition.onresult = function (event) {
                    let interim_transcript = '';
                    if (typeof (event.results) == 'undefined') {
                        widgetRecognition.onend = null;
                        widgetRecognition.stop();
                        vswcWidgetSearch.placeholder = vswcMessages['unableToHear'];

                        // Play 'micConnect' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                        vswcAudioPlayer.play();
                        return;
                    }

                    let eventResultsLength = event.results.length;

                    for (let i = event.resultIndex; i < eventResultsLength; ++i) {
                        if (event.results[i].isFinal) {
                            widget_final_transcript = event.results[i][0].transcript;

                            if (isAndroid == false) {
                                widgetProcessEnd();
                                widgetRecognition.stop();
                            }
                        } else {
                            interim_transcript += event.results[i][0].transcript;
                        }
                    }
                };

                vswcWidgetToggleButton.addEventListener(vswcMicEventToListen, function (event) {
                    if (vswcAnyOtherMicListening(vswcWidgetToggleButton.getAttribute('id'), vswcWidgetToggleButton) === true) return;

                    if (widgetRecognizing) {
                        // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                        vswcClearMicResetTimeout();

                        // Stop ongoing playback if nay
                        if (vswcAudioPlayer.isPlaying()) {
                            vswcAudioPlayer.stop();
                        }

                        if (isAndroid == false) {
                            widgetProcessEnd();
                            widgetRecognition.stop();
                        }
                    } else {
                        vswcSingleClickMicEffect('add');
                        event.preventDefault();

                        // Stop ongoing playback if nay
                        if (vswcAudioPlayer.isPlaying()) {
                            vswcAudioPlayer.stop();
                        }

                        widgetFinalTranscript = '';
                        widgetRecognizing = true;
                        widgetRecognition.lang = !!vswcSttLanguageContext['gcp']['stt'] ? vswcSttLanguageContext['gcp']['langCode'] : 'en-US';
                        widgetRecognition.start();
                        widget_ignore_onend = false;

                        // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                        vswcClearMicResetTimeout();

                        // To set new mic reset timeout. (Based on duration from settings)
                        window.vswcMicTimeoutIdentifier = setTimeout(function () {
                            let updatedClassList = vswcWidgetToggleButton.classList;

                            if (updatedClassList && updatedClassList.contains('listening')) {
                                vswcWidgetToggleButton.click();
                            }
                        }, vswcMicListenAutoTimeoutDuration);
                    }
                });
            } else {
                //CODE FOR BROWSERS THAT DO NOT SUPPORT STT NATIVLY
                // MUST USE THE BUILT IN MICROPHONE
                vswcWidgetToggleButton.addEventListener(vswcMicEventToListen, function (event) {
                    /**
                     * Audio element's play method must be invoked in exact influence of user gesture to avoid auto play restriction
                     * 
                     */
                    if (
                        vswcClientInfo.ios === true
                        || (vswcClientInfo.iosSafari && !vswcClientInfo.chrome && !vswcClientInfo.firefox)
                        || (vswcClientInfo.windows && vswcClientInfo.firefox)
                    ) {
                        vswcAudioPlayer.configure(vswcSilenceSoundPath);
                        vswcAudioPlayer.play();
                    }

                    if (vswcAnyOtherMicListening(vswcWidgetToggleButton.getAttribute('id'), vswcWidgetToggleButton) === true) return;

                    // Deny recording if microphone is not accessible
                    if (!vswcAudioRecorder || !vswcAudioContext) {
                        vswcInitAudio(function (a) {
                            if (!vswcAudioRecorder || !vswcAudioContext) {
                                vswcWidgetSearch.placeholder = vswcMessages['micNotAccessible'];
                                return false;
                            } else {
                                widgetListenEvent();
                            }
                        });
                    } else {
                        widgetListenEvent();
                    }

                    function widgetListenEvent() {
                        // If API system key is unavailable then acknowledge service unavailability and stop voice navigation.
                        if (!(typeof (vswc.vswcXApiKey) != 'undefined' && vswc.vswcXApiKey !== null)) {
                            // Play 'unavailable' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['unavailable']);
                            vswcAudioPlayer.play();

                            return false;
                        }

                        // User ending recording by clicking back mic
                        if (widgetRecognizing) {
                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // Stop recorder
                            vswcAudioRecorder.stop();

                            // Stop access to audio resource
                            vswcStopAudio();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            //replace recording with mic icon
                            vswcSingleClickMicEffect('remove');

                            vswcWidgetSearch.placeholder = vswcMessages['transcribeText'];

                            vswcAudioRecorder.getBuffers(function (buffers) {
                                if (!!vswcSttLanguageContext['gcp']['stt']) {
                                    vswcAudioRecorder.exportMonoWAV(function (blob) {
                                        vswcAudioRecorder.convertBlobToBase64(blob).then(function (resultedBase64) {
                                            vswcGcpStt(resultedBase64).then(function (transcriptResult) {
                                                vswcWidgetSearch.value = transcriptResult;

                                                // Play 'basic' playback
                                                vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () {
                                                });
                                                vswcAudioPlayer.play();
                                                setTimeout(() => {
                                                    vswcWidgetForm.submit();
                                                }, 2000);
                                            }).catch(function (error) {
                                                // Play 'notAudible' playback
                                                vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                                vswcAudioPlayer.play();

                                                vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                            })
                                        }).catch(function (error) {
                                            // Play 'notAudible' playback
                                            vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                            vswcAudioPlayer.play();

                                            vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                        });
                                    });
                                } else {
                                    // Play 'notAudible' playback
                                    vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                    vswcAudioPlayer.play();
                                    vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                }
                            });

                            widgetRecognizing = false;
                            return;
                        } else {// User started recording by clicking mic
                            vswcSingleClickMicEffect('add');
                            event.preventDefault();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            widgetFinalTranscript = '';

                            widgetRecognizing = true;
                            vswcAudioRecorder.clear();
                            vswcAudioRecorder.record(vswcWidgetToggleButton);

                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // To set new mic reset timeout. (Based on duration from settings)
                            window.vswcMicTimeoutIdentifier = setTimeout(function () {
                                let updatedClassList = vswcWidgetToggleButton.classList;

                                if (updatedClassList && updatedClassList.contains('listening')) {
                                    vswcWidgetToggleButton.click();
                                }
                            }, vswcMicListenAutoTimeoutDuration);
                        }
                    }
                }, false);
            }
        }

        function disableSingleClick() {
            if ('webkitSpeechRecognition' in window && vswcClientInfo['chrome'] === true) {
                let widgetRecognition = new webkitSpeechRecognition();
                widgetRecognition.continuous = true;
                widgetRecognition.interimResults = true;

                widgetRecognition.onstart = function () {
                    widgetRecognizing = true;
                };

                widgetRecognition.onerror = function (event) {
                    vswcWidgetMic.classList.remove('listening');
                    widgetRecognizing = false;

                    if (event.error == 'no-speech') {
                        // Play feature unavailable playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                        vswcAudioPlayer.play();

                        widget_ignore_onend = true;
                        vswcWidgetSearch.placeholder = vswcMessages['unableToHear'];
                    }

                    if (event.error == 'audio-capture') {
                        // Play 'micConnect' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                        vswcAudioPlayer.play();

                        widget_ignore_onend = true;
                        vswcWidgetSearch.placeholder = vswcMessages['micNotAccessible'];
                    }

                    if (event.error == 'not-allowed') {
                        // Play 'micConnect' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                        vswcAudioPlayer.play();

                        widget_ignore_onend = true;
                        vswcWidgetSearch.placeholder = vswcMessages['browserDenyMicAccess'];
                    }
                };

                function widgetProcessEnd() {
                    widgetRecognizing = false;

                    if (widget_ignore_onend) { return; }

                    widgetFinalTranscript = widget_final_transcript;
                    vswcWidgetMic.classList.remove('listening');

                    if (typeof (widgetFinalTranscript) != 'undefined' && widgetFinalTranscript.length != 0) {
                        vswcWidgetSearch.value = widgetFinalTranscript;

                        // Play 'basic' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () {
                        });
                        vswcAudioPlayer.play();
                        setTimeout(() => {
                            vswcWidgetForm.submit();
                        }, 2000);
                    } else {
                        // Play 'notAudible' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                        vswcAudioPlayer.play();

                        vswcWidgetSearch.placeholder = vswcMessages['ask'];
                    }

                }

                widgetRecognition.onend = function () {
                    if (isAndroid) { widgetProcessEnd(); }
                };

                widgetRecognition.onresult = function (event) {
                    let interim_transcript = '';

                    if (typeof (event.results) == 'undefined') {
                        widgetRecognition.onend = null;
                        widgetRecognition.stop();
                        vswcWidgetSearch.placeholder = vswcMessages['unableToHear'];

                        // Play 'micConnect' playback
                        vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
                        vswcAudioPlayer.play();

                        return;
                    }

                    let eventResultsLength = event.results.length;

                    for (let i = event.resultIndex; i < eventResultsLength; ++i) {
                        if (event.results[i].isFinal) {
                            widget_final_transcript = event.results[i][0].transcript;

                            if (isAndroid == false) {
                                widgetProcessEnd();
                                widgetRecognition.stop();
                            }
                        } else {
                            interim_transcript += event.results[i][0].transcript;
                        }
                    }
                };

                vswcWidgetMic.addEventListener(vswcMicEventToListen, function (event) {
                    if (vswcAnyOtherMicListening(vswcWidgetMic.getAttribute('id'), vswcWidgetMic) === true) return;

                    if (widgetRecognizing) {
                        // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                        vswcClearMicResetTimeout();

                        // Stop ongoing playback if nay
                        if (vswcAudioPlayer.isPlaying()) {
                            vswcAudioPlayer.stop();
                        }

                        if (isAndroid == false) {
                            widgetProcessEnd();
                            widgetRecognition.stop();
                        }
                    } else {
                        vswcWidgetMic.classList.add('listening');
                        event.preventDefault();

                        // Stop ongoing playback if nay
                        if (vswcAudioPlayer.isPlaying()) {
                            vswcAudioPlayer.stop();
                        }

                        widgetFinalTranscript = '';
                        widgetRecognizing = true;
                        widgetRecognition.lang = !!vswcSttLanguageContext['gcp']['stt'] ? vswcSttLanguageContext['gcp']['langCode'] : 'en-US';
                        widgetRecognition.start();
                        widget_ignore_onend = false;

                        // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                        vswcClearMicResetTimeout();

                        // To set new mic reset timeout. (Based on duration from settings)
                        window.vswcMicTimeoutIdentifier = setTimeout(function () {
                            let updatedClassList = vswcWidgetMic.classList;

                            if (updatedClassList && updatedClassList.contains('listening')) {
                                vswcWidgetMic.click();
                            }
                        }, vswcMicListenAutoTimeoutDuration);
                    }
                });
            } else {
                //CODE FOR BROWSERS THAT DO NOT SUPPORT STT NATIVLY
                // MUST USE THE BUILT IN MICROPHONE
                vswcWidgetMic.addEventListener(vswcMicEventToListen, function (event) {
                    /**
                     * Audio element's play method must be invoked in exact influence of user gesture to avoid auto play restriction
                     * 
                     */
                    if (
                        vswcClientInfo.ios === true
                        || (vswcClientInfo.iosSafari && !vswcClientInfo.chrome && !vswcClientInfo.firefox)
                        || (vswcClientInfo.windows && vswcClientInfo.firefox)
                    ) {
                        vswcAudioPlayer.configure(vswcSilenceSoundPath);
                        vswcAudioPlayer.play();
                    }

                    if (vswcAnyOtherMicListening(vswcWidgetMic.getAttribute('id'), vswcWidgetMic) === true) return;

                    // Deny recording if microphone is not accessible
                    if (!vswcAudioRecorder || !vswcAudioContext) {
                        vswcInitAudio(function (a) {
                            if (!vswcAudioRecorder || !vswcAudioContext) {
                                vswcWidgetSearch.placeholder = vswcMessages['micNotAccessible'];
                                return false;
                            } else {
                                widgetListenEvent();
                            }
                        });
                    } else {
                        widgetListenEvent();
                    }

                    function widgetListenEvent() {
                        // If API system key is unavailable then acknowledge service unavailability and stop voice navigation.
                        if (!(typeof (vswc.vswcXApiKey) != 'undefined' && vswc.vswcXApiKey !== null)) {
                            // Play 'unavailable' playback
                            vswcAudioPlayer.configure(vswcAlternativeResponse['unavailable']);
                            vswcAudioPlayer.play();

                            return false;
                        }

                        // User ending recording by clicking back mic
                        if (widgetRecognizing) {
                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // Stop recorder
                            vswcAudioRecorder.stop();

                            // Stop access to audio resource
                            vswcStopAudio();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            //replace recording with mic icon
                            vswcWidgetMic.classList.remove('listening');

                            vswcWidgetSearch.placeholder = vswcMessages['transcribeText'];

                            vswcAudioRecorder.getBuffers(function (buffers) {
                                if (!!vswcSttLanguageContext['gcp']['stt']) {
                                    vswcAudioRecorder.exportMonoWAV(function (blob) {
                                        vswcAudioRecorder.convertBlobToBase64(blob).then(function (resultedBase64) {
                                            vswcGcpStt(resultedBase64).then(function (transcriptResult) {
                                                vswcWidgetSearch.value = transcriptResult;

                                                // Play 'basic' playback
                                                vswcAudioPlayer.configure(vswcAlternativeResponse['basic'], function () {
                                                });
                                                vswcAudioPlayer.play();
                                                setTimeout(() => {
                                                    vswcWidgetForm.submit();
                                                }, 2000);
                                            }).catch(function (error) {
                                                // Play 'notAudible' playback
                                                vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                                vswcAudioPlayer.play();

                                                vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                            })
                                        }).catch(function (error) {
                                            // Play 'notAudible' playback
                                            vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                            vswcAudioPlayer.play();

                                            vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                        });
                                    });
                                } else {
                                    // Play 'notAudible' playback
                                    vswcAudioPlayer.configure(vswcAlternativeResponse['notAudible']);
                                    vswcAudioPlayer.play();
                                    vswcWidgetSearch.placeholder = vswcMessages['ask'];
                                }
                            });

                            widgetRecognizing = false;
                            return;
                        } else {// User started recording by clicking mic
                            vswcWidgetMic.classList.add('listening');
                            event.preventDefault();

                            // Stop ongoing playback if nay
                            if (vswcAudioPlayer.isPlaying()) {
                                vswcAudioPlayer.stop();
                            }

                            widgetFinalTranscript = '';

                            widgetRecognizing = true;
                            vswcAudioRecorder.clear();
                            vswcAudioRecorder.record(vswcWidgetMic);

                            // To clear pre-existing mic reset timeout if any. (Based on duration from settings)
                            vswcClearMicResetTimeout();

                            // To set new mic reset timeout. (Based on duration from settings)
                            window.vswcMicTimeoutIdentifier = setTimeout(function () {
                                let updatedClassList = vswcWidgetMic.classList;

                                if (updatedClassList && updatedClassList.contains('listening')) {
                                    vswcWidgetMic.click();
                                }
                            }, vswcMicListenAutoTimeoutDuration);
                        }
                    }
                }, false);
            }
        }

        if (vswcIsElementor == true) {
            enableElementor();
        }

        if (vswcIsSingleClick == true) {
            enableSingleClick();
            vswcFloatingMicKeyBoardAccess('single');
        }

        else {
            disableSingleClick();
            vswcFloatingMicKeyBoardAccess('double');
        }

        /*###############################################################################*/

        /**
         * Function to toggle class of the HTML element
         *
         * @param {elmSelector - String} : CSS Selector
         * @param {nameOfClass - String} : Class name to add/remove
         */
        function vswcToggleClass(elmSelector, nameOfClass) {
            if (!(typeof (elmSelector) != 'undefined' && elmSelector != null && elmSelector.length != 0)) return false;

            let element = document.querySelector(elmSelector);

            if (element.classList) {
                element.classList.toggle(nameOfClass);
            } else {
                // For IE9

                let classes = element.className.split(" ");
                let i = classes.indexOf(nameOfClass);

                if (i >= 0) {
                    classes.splice(i, 1);
                } else {
                    classes.push(nameOfClass);
                    element.className = classes.join(" ");
                }
            }
        }

        /**
         * Function to toggle chat and links
         */
        function vswcToggleWidgetElements() {
            if (vswcIsSingleClick == true) {
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-toggle-btn-mic');
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-toggle-btn-mic');
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-widget-active');
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-widget-visible');
                vswcToggleClass('#vswcWidgetToggleButton', 'vswc-widget-float');
                vswcToggleClass('.vswc-widget-button', 'vswc-widget-visible');
            }

            else {
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-toggle-btn-mic');
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-toggle-btn-close');
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-widget-active');
                vswcToggleClass('.vswc-widget-toggle-button', 'vswc-widget-visible');
                vswcToggleClass('#vswcWidgetToggleButton', 'vswc-widget-float');
                vswcToggleClass('.vswc-widget-chat-wrapper', 'vswc-widget-visible');
                vswcToggleClass('.vswc-widget-button', 'vswc-widget-visible');
            }
        }
    })();
};
