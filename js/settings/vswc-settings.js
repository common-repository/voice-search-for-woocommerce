
/**
 * Function to reset auto end mic listening timeout
 *
 * @param this- DOMElement Object
 * @param evt - Event 
 */
function vswcResetTimeoutDefaultValue(el, evt) {
    if (typeof (el) == 'undefined') return;

    if (el.value.length == 0) {
        el.value = "8";
    } else if (parseInt(el.value) > 20) {
        el.value = "20";
    } else if (parseInt(el.value) < 8) {
        el.value = "8";
    }
}

/**
 * Function to validate length of timeout value
 *
 * @param this- DOMElement Object
 * @param evt - Event 
 */
function vswcValidateTimeoutValue(el, evt) {
    if (typeof (el) == 'undefined') return;

    if (el.value.length == 2 && parseInt(el.value) > 20) {
        evt.preventDefault();
    }
}
/**
 * Function to handel keyboard special key or normal key
 * 
 * @param Key - string : Selected key type
 */
function vswctoggleInputFieldOtherKey(Key = 'OtherKey') {
    try {
        let vswcaOtherKey = document.querySelector('input#vswcKeyBoardSwitch');
        let vswcaOtherInput = document.getElementsByClassName('vswcShowOtherInput')[0];
        let warningField = document.getElementsByClassName('vswcWarningInputKey')[0];
        if (Key === 'OtherKey') {
            vswcaOtherKey.removeAttribute('disabled');
            vswcaOtherInput.classList.remove('vswc-hide');
            vswcaOtherKey.setAttribute('required', 'required');
        } else {
            vswcaOtherKey.setAttribute('disabled', 'disabled');
            vswcaOtherInput.classList.add('vswc-hide');
            vswcaOtherKey.removeAttribute('required');
        }
        warningField.innerHTML = "";
    } catch (error) {

    }
}

/**
 * Function for validate input keyboard key that can store only single char from a-z
 * 
 * @param {el: HTMLDomObject} 
 * @param {evt} event  
 */
function vswcValidateValueForOtherKey(el, evt) {
    let warningField = document.getElementsByClassName('vswcWarningInputKey')[0];
    if (evt.data == null) {
        warningField.innerHTML = "";
    } else if (evt.data.charCodeAt(0) >= 97 && evt.data.charCodeAt(0) <= 122) {
        el.value = evt.data;
        warningField.innerHTML = "";
    } else {
        warningField.innerHTML = `<span style="color: red;"><b>&#9888;</b> Please enter lowercase letters only (a-z) </span>`;
        el.value = '';
    }
}

// ########################################################################
//
// For Window and Document load and Unload Events
//
// ########################################################################
window.addEventListener('load', function () {

    if (this.document.getElementById('vswcSpecialKeyOtherKey')) {
        if (this.document.getElementById('vswcSpecialKeyOtherKey').checked) {
            this.document.getElementsByClassName('vswcShowOtherInput')[0].classList.remove('vswc-hide');
            this.document.getElementById('vswcKeyBoardSwitch').setAttribute('required', 'required');
        }
    }
});
