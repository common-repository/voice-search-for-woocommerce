// *****************************************************************************************************
// *******              speak2web VOICE SEARCH FOR WooCommerce                                     ***********
// *******               Get your subscription at                                            ***********
// *******                    https://speak2web.com/plugin#plans                             ***********
// *******               Need support? https://speak2web.com/support                         ***********
// *******               Licensed GPLv2+                                                     ***********
//******************************************************************************************************

window.AudioContext = window.AudioContext || window.webkitAudioContext;

var vswcAudioContext = null;
var vswcAudioInput = null,
    vswcRealAudioInput = null,
    vswcInputPoint = null,
    vswcAudioRecorder = null;
var vswcRecIndex = 0;
var initCB = null;
let vswcStream = null;

/**
 * Function to initialize capture audio resources
 * 
 * @param { cb: function } A callback function
 */
function vswcInitAudio(cb) {
    initCB = cb;

    // Check when last service log was updated
    try {
        let vswcLastUpdatedAtTimestamp = vswcServiceLogs.updatedAt || null;

        if (vswcLastUpdatedAtTimestamp !== null) {
            vswcLastUpdatedAtTimestamp = Number(vswcLastUpdatedAtTimestamp);
            let currentUtcTimestamp = Math.round(new Date().getTime() / 1000);

            // Add 24 hours to last updated timestamp
            vswcLastUpdatedAtTimestamp = vswcLastUpdatedAtTimestamp + (24 * 3600);

            // Check if last service call log update was older than 24 hours
            if (currentUtcTimestamp >= vswcLastUpdatedAtTimestamp) {
                // Log service call count
                vswcLogServiceCall(1);
            }
        }
    } catch (err) {
        // do nothing
    }

    vswcAudioContext = new AudioContext();

    navigator.mediaDevices.getUserMedia({ "audio": !0 })
        .then(vswcGotStream)
        .catch(function (e) {
            // Play 'micConnect' playback
            vswcAudioPlayer.configure(vswcAlternativeResponse['micConnect']);
            vswcAudioPlayer.play();

            console.log("VF: We caught en error while gaining access to audio input due to: ", e.message);
        }
        );
}

/**
 * A callback function to obtain audio stream
 * 
 * @param { stream: MediaStream } An audio track 
 */
function vswcGotStream(stream) {
    vswcInputPoint = vswcAudioContext.createGain();
    vswcStream = stream;

    // Create an AudioNode from the stream.
    vswcRealAudioInput = vswcAudioContext.createMediaStreamSource(stream);
    vswcAudioInput = vswcRealAudioInput;
    vswcAudioInput.connect(vswcInputPoint);

    vswcAudioRecorder = new Recorder(vswcInputPoint);
    initCB(vswcAudioRecorder);
}

/**
 * Function to stop accessing audio resource
 *
 */
function vswcStopAudio() {
    try {
        vswcStream.getTracks().forEach(function (track) {
            track.stop();
        });

        vswcAudioContext.close();
        vswcAudioContext = null;
    } catch (err) {
        console.log('VSWC Exception: Unable to release audio resource due to: ' + err.message);
    }
}
