<?php
defined('WPINC') or die;

class Voice_Search_For_WooCommerce_Plugin extends WP_Stack_Plugin2
{

    /**
     * @var self
     */
    public static $plugin_directory_path = null;
    public static $vswc_ios = false;
    public static $vswc_url = "";
    public static $is_chrome = false;
    public static $vswc_license_key = "";
    public static $vswc_api_access_key = null;
    public static $vswc_admin_notice_logo = "";
    public static $vswc_selected_language = "en-US";
    public static $vswc_floating_mic_position = "Middle Right";
    //public static $vswc_file_type  = '.min';
    public static $vswc_file_type = ''; // For debugging
    public static $vswc_settings_updated_ts = null;

    /**
     * This map of language name as value (Eg: English) maps to value being saved to DB for plugin language option on settings page
     *
     * With additional 130 language support feature this fallback is needed to preserve plugin language while upgrading/updating existing plugin on their site
     */
    public static $vswc_fallback_lang_map = array(
        'en-US' => 'English',
        'en-GB' => 'British English',
        'de-DE' => 'German',
        'pt-PT' => 'Portuguese',
        'zh-CN' => 'Chinese',
        'zh-TW' => 'Chinese',
        'fr-FR' => 'French',
        'ja-JP' => 'Japanese',
        'ko-KR' => 'Korean',
        'es-ES' => 'Spanish'
    );

    // For access keys
    public static $vswc_voice_services_access_keys = array(
        'api_url' => "https://yjonpgjqs9.execute-api.us-east-1.amazonaws.com/V2",
        'db_col_name' => 'vswc_navigation_voice_services_access_keys',
        'value' => array(
            'g_stt_key' => null,
            'g_tts_key' => null,
            'synched_at' => null
        )
    );

    /**
     * Plugin version.
     */
    const VSWC_VERSION = '2.1.0';

    /**
     * Constructs the object, hooks in to `plugins_loaded`.
     */
    protected function __construct()
    {
        // Get database values
        self::$vswc_license_key = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['license_key'], null);
        self::$vswc_license_key = self::vswc_sanitize_variable_for_local_script(self::$vswc_license_key);

        // Get API access key.
        self::$vswc_api_access_key = get_option('vswc_api_system_key', null);
        self::$vswc_api_access_key = self::vswc_sanitize_variable_for_local_script(self::$vswc_api_access_key);

        self::$vswc_selected_language = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['selected_language'], 'en-US');
        self::$vswc_selected_language = self::vswc_sanitize_variable_for_local_script(self::$vswc_selected_language);

        // Detect OS by user agent
        $iPod = sanitize_text_field(stripos($_SERVER['HTTP_USER_AGENT'], "iPod"));
        $iPhone = sanitize_text_field(stripos($_SERVER['HTTP_USER_AGENT'], "iPhone"));
        $iPad = sanitize_text_field(stripos($_SERVER['HTTP_USER_AGENT'], "iPad"));
        $chrome_browser = sanitize_text_field(stripos($_SERVER['HTTP_USER_AGENT'], "Chrome"));

        if (!($iPod == false && $iPhone == false && $iPad == false)) { /*self::$vswc_ios = true;*/
        }

        if ($chrome_browser != false) { /*self::$is_chrome = true;*/
        }

        $this->hook('plugins_loaded', 'add_hooks');
    }

    /**
     * Static method to get third party voice services access keys
     *
     */
    public static function vswc_get_access_keys_from_db()
    {
        $temp_access_keys_from_db = get_option(self::$vswc_voice_services_access_keys['db_col_name'], null);

        if (!!$temp_access_keys_from_db && is_array($temp_access_keys_from_db)) {
            if (array_key_exists('g_stt_key', $temp_access_keys_from_db)) {
                self::$vswc_voice_services_access_keys['value']['g_stt_key'] = $temp_access_keys_from_db['g_stt_key'];
            }

            if (array_key_exists('g_tts_key', $temp_access_keys_from_db)) {
                self::$vswc_voice_services_access_keys['value']['g_tts_key'] = $temp_access_keys_from_db['g_tts_key'];
            }

            if (array_key_exists('synched_at', $temp_access_keys_from_db)) {
                self::$vswc_voice_services_access_keys['value']['synched_at'] = $temp_access_keys_from_db['synched_at'];
            }

            unset($temp_access_keys_from_db);
        }
    }


    /**
     * Adds hooks.
     */
    public function add_hooks()
    {
        self::$vswc_settings_updated_ts = Voice_Search_For_WooCommerce_Settings_Page::vswc_settings_modified_timestamp('set');

        $this->hook('init');
        $this->hook('admin_enqueue_scripts', 'enqueue_admin_scripts');

        if (
            (!empty(self::$vswc_license_key) && !empty(self::$vswc_api_access_key)) ||
            (VSWC_CLIENT['chrome'] === true && VswcLanguage::gcp_supported(self::$vswc_selected_language))
        ) {
            $this->hook('wp_enqueue_scripts', 'enqueue_frontend_scripts');
        }

        // Register action to hook into admin_notices to display dashboard notice for non-HTTPS site
        if (is_ssl() == false) {
            add_action('admin_notices', function () {
                ?>
                                <div class="notice notice-error is-dismissible">
                                    <p>
                                        <?php echo wp_kses_post(self::$vswc_admin_notice_logo); ?>
                                        <br />
                                        <?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['other']['nonHttpsNotice']); ?>
                                    </p>
                                </div>
                                <?php
            });
        }

        // Generate mp3 files on version change
        Voice_Search_For_WooCommerce_Settings_Page::vswc_generate_short_phrases_on_update(self::$vswc_selected_language);

        // Register the STT service call action
        add_action('wp_ajax_' . 'vswc_log_service_call', array($this, 'vswc_log_service_call'));
        add_action('wp_ajax_nopriv_' . 'vswc_log_service_call', array($this, 'vswc_log_service_call'));

        // Register the action for HTTP Ajax request to refresh voice services token and keys
        add_action('wp_ajax_nopriv_' . 'vswc_refresh_access_keys', array($this, 'vswc_refresh_access_keys'));
        add_action('wp_ajax_' . 'vswc_refresh_access_keys', array($this, 'vswc_refresh_access_keys'));

        // Register action to hook into admin_notices to display dahsboard notices when license key is missing or invalid
        if ((empty(self::$vswc_license_key) || empty(self::$vswc_api_access_key)) && VSWC_CLIENT['chrome'] === false) {
            add_action('admin_notices', array($this, 'notice_non_chrome'));
        }
    }

    /**
     * Method as action to invoke when license key is missing and browser is non chrome
     */
    public function notice_non_chrome()
    {
        ?>
                <div class="notice notice-warning is-dismissible">
                    <p>
                        <?php echo wp_kses_post(self::$vswc_admin_notice_logo); ?>
                        <br />
                        <?php echo wp_kses_post("<b>" . VSWC_LANGUAGE_LIBRARY['other']['nonChromeNotice']['warning'] . "</b>" . VSWC_LANGUAGE_LIBRARY['other']['nonChromeNotice']['thisPlugin']); ?>
                        <a target="blank" href="https://speak2web.com/plugin/#plan">
                            <?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['other']['nonChromeNotice']['goPro']); ?>
                        </a>
                        <?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['other']['nonChromeNotice']['supportMoreBrowsers']); ?>
                    </p>
                </div>
                <?php
    }

    /**
     * Initializes the plugin, registers textdomain, etc.
     * Most of WP is loaded at this stage, and the user is authenticated
     */
    public function init()
    {
        self::$vswc_url = $this->get_url();
        self::$vswc_admin_notice_logo = "<img style='margin-left: -7px;vertical-align:middle;width:110px; height: 36px;' src='" . self::$vswc_url . "images/speak2web_logo.png'/>|<b> Voice Search For WooCommerce</b>";

        // Get plugin directory path and add trailing slash if needed (For browser compatibility)
        self::$plugin_directory_path = plugin_dir_path(__DIR__);
        $trailing_slash = substr(self::$plugin_directory_path, -1);

        if ($trailing_slash != '/') {
            self::$plugin_directory_path .= '/';
        }

        if (isset($GLOBALS['pagenow']) && $GLOBALS['pagenow'] == 'plugins.php') {
            add_filter('plugin_row_meta', array(&$this, 'custom_plugin_row_meta'), 10, 2);
        }

        $this->load_textdomain('voice-search-for-woocommerce', '/languages');

        // To enable floating mic by default (only when 'vswc_floating_mic' option is missing from DB)
        $is_vswc_floating_mic_exist = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['floating_mic']);

        if ($is_vswc_floating_mic_exist === false) {
            update_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['floating_mic'], 'yes');
        }

        // Get floating mic position from DB
        self::$vswc_floating_mic_position = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['floating_mic_position']);

        if (self::$vswc_floating_mic_position === false) {
            update_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['floating_mic_position'], 'Middle Right');
            self::$vswc_floating_mic_position = 'Middle Right';
        }

        // load access keys of third party voice services from local DB
        self::vswc_get_access_keys_from_db();

        // Obtain third party voice services token and keys from api
        self::vswc_synch_voice_access_keys();
    }

    /**
     * Static method to get data related to file
     *
     * @param $intent - string : 'url' or 'timestamp'
     * @param $partial_file_path - string : Path of file (Partial and mostly relative path)
     * @param $file_extension - string : 'js' or 'css'
     *
     * $returns $vswc_file_data - string : Time as a Unix timestamp or absolute url to the file
     */
    public static function vswc_get_file_meta_data($intent = "", $partial_file_path = "", $file_extension = "")
    {
        $vswc_file_data = "";

        try {
            if (empty($file_extension) || empty($partial_file_path) || empty($intent))
                throw new Exception("VDN: Error while getting file data.", 1);

            $intent = strtolower(trim($intent));
            $file_ext = '.' . str_replace(".", "", trim($file_extension));
            $partial_file_path = trim($partial_file_path);

            if ($intent == 'timestamp') {
                if (!empty(self::$vswc_settings_updated_ts)) {
                    $vswc_file_data = self::$vswc_settings_updated_ts;
                } else {
                    $vswc_file_data = filemtime(VSWC_PLUGIN['ABS_PATH'] . $partial_file_path . self::$vswc_file_type . $file_ext);
                }
            } else if ($intent == 'url') {
                $vswc_file_data = VSWC_PLUGIN['ABS_URL'] . $partial_file_path . self::$vswc_file_type . $file_ext;
            }
        } catch (\Exception $ex) {
            $vswc_file_data = "";
        }

        return $vswc_file_data;
    }

    /**
     * Method to enqueue JS scripts and CSS of Admin for loading 
     */
    public function enqueue_admin_scripts()
    {
        // Enqueue CSS: vswc-settings.css
        wp_enqueue_style(
            'vswc_settings_css',
            self::vswc_get_file_meta_data('url', 'css/settings/vswc-settings', 'css'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'css/settings/vswc-settings', 'css'),
            'screen'
        );

        // Enqueue JS: vswc-settings.js
        wp_enqueue_script(
            'vswc-settings',
            self::vswc_get_file_meta_data('url', 'js/settings/vswc-settings', 'js'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'js/settings/vswc-settings', 'js'),
            true
        );

    }

    /**
     * Method to enqueue JS scripts and CSS for loading at Front end
     */
    public function enqueue_frontend_scripts()
    {
        //################################################################################
        //
        // Enqueue 'voice-search-for-woocommerce' CSS file to load at front end
        //
        //################################################################################
        wp_enqueue_style(
            'voice-search-for-woocommerce',
            self::vswc_get_file_meta_data('url', 'css/voice-search-for-woocommerce', 'css'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'css/voice-search-for-woocommerce', 'css'),
            'screen'
        );

        //################################################################################
        //
        // Enqueue 'vswc.text-library' javasctipt file to load at front end
        //
        //################################################################################        
        wp_enqueue_script(
            'vswc.text-library',
            self::vswc_get_file_meta_data('url', 'js/vswc.text-library', 'js'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'js/vswc.text-library', 'js'),
            true
        );

        //##################################################################################################################
        // Determine STT language context for plugin
        //##################################################################################################################
        $vswc_stt_language_context = array(
            'gcp' => array(
                'stt' => 'N',
                'langCode' => null,
                'endPoint' => null,
                'key' => null,
                'qs' => array('key' => null)
            )
        );

        $vswc_gcp_supported = VswcLanguage::gcp_supported(self::$vswc_selected_language);
        $vswc_lang_not_supported_by_vendors = false;

        if (VSWC_CLIENT['chrome'] === true) {
            if ($vswc_gcp_supported === true) {
                $vswc_stt_language_context['gcp']['stt'] = 'Y';
            } else {
                $vswc_stt_language_context['gcp']['stt'] = 'Y';
                $vswc_lang_not_supported_by_vendors = true;
            }
        } else {
            if ($vswc_gcp_supported === true) {
                $vswc_stt_language_context['gcp']['stt'] = 'Y';
            }
        }

        if ($vswc_lang_not_supported_by_vendors === true) {
            self::$vswc_selected_language = 'en-US';
            update_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['selected_language'], self::$vswc_selected_language);
        }

        if ($vswc_stt_language_context['gcp']['stt'] == 'Y') {
            $vswc_gcp_lang_code = VswcLanguage::$gcp_language_set[self::$vswc_selected_language][VswcLanguage::LANG_CODE];
            $vswc_gcp_key = self::$vswc_voice_services_access_keys['value']['g_stt_key'];

            $vswc_stt_language_context['gcp']['endPoint'] = 'https://speech.googleapis.com/v1/speech:recognize';
            $vswc_stt_language_context['gcp']['langCode'] = $vswc_gcp_lang_code;
            $vswc_stt_language_context['gcp']['key'] = $vswc_gcp_key;
            $vswc_stt_language_context['gcp']['qs']['key'] = '?key=';
        }

        wp_localize_script('vswc.text-library', '_vswcSttLanguageContext', $vswc_stt_language_context);
        wp_localize_script('vswc.text-library', '_vswcTextPhrases', VswcLanguage::$textual_phrases[self::$vswc_selected_language]);


        $count_nonce = wp_create_nonce('service_call_count');
        $vswc_keys_refresh_nonce = wp_create_nonce('keys_refresh');

        wp_localize_script(
            'vswc.text-library',
            'vswcAjaxObj',
            array(
                'ajax_url' => admin_url('admin-ajax.php'),
                'nonce' => $count_nonce,
                'keys_nonce' => $vswc_keys_refresh_nonce
            )
        );

        $protocol = sanitize_text_field((!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off' || $_SERVER['SERVER_PORT'] == 443) ? "https://" : "http://");
        $domainName = sanitize_text_field($_SERVER['SERVER_NAME']);

        wp_add_inline_script('vswc.text-library', 'vswcWorkerPath =' . json_encode($this->get_url() . 'js/recorderjs/vswc.audio-recorder-worker' . self::$vswc_file_type . '.js'));

        $vswc_floating_mic = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['floating_mic'], null);
        $vswc_floating_mic = self::vswc_sanitize_variable_for_local_script($vswc_floating_mic);

        wp_localize_script(
            'vswc.text-library',
            'voice_search_for_woocommerce',
            array(
                'button_message' => __('Speech Input', 'voice-search-for-woocommerce'),
                'talk_message' => __('Start Talking…', 'voice-search-for-woocommerce'),
            )
        );

        $vswc_mic_listening_timeout = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['mic_listening_timeout'], null);
        $vswc_mic_listening_timeout = self::vswc_sanitize_variable_for_local_script($vswc_mic_listening_timeout);

        if (is_null($vswc_mic_listening_timeout)) {
            update_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['mic_listening_timeout'], '8');
            $vswc_mic_listening_timeout = '8';
        }


        $vswc_current_value = get_option('vswc_current_value', "0");
        $vswc_last_value = get_option('vswc_last_value', "0");
        $vswc_last_value_updated_at = get_option('vswc_last_value_updated_at', null);
        $vswc_last_value_updated_at = self::vswc_sanitize_variable_for_local_script($vswc_last_value_updated_at);

        $vswc_service_logs = array(
            'updatedAt' => $vswc_last_value_updated_at,
            'currentValue' => $vswc_current_value,
            'lastValue' => $vswc_last_value,
        );

        wp_localize_script('vswc.text-library', 'vswcServiceLogs', $vswc_service_logs);

        $vswc_mute_audio_phrases = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['mute_audio_phrases'], null);
        $vswc_mute_audio_phrases = self::vswc_sanitize_variable_for_local_script($vswc_mute_audio_phrases);

        $vswc_single_click = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['single_click'], null);
        $vswc_single_click = self::vswc_sanitize_variable_for_local_script($vswc_single_click);

        $vswc_elementor = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['elementor_mic'], null);
        $vswc_elementor = self::vswc_sanitize_variable_for_local_script($vswc_elementor);

        // Localizes a registered script with JS variable for Keyboard Mic Switch
        $vswc_keyboard_mic_switch = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['keyboard_mic_switch'], '');
        $vswc_keyboard_mic_switch = self::vswc_sanitize_variable_for_local_script($vswc_keyboard_mic_switch);

        // Localizes a registered script with JS variable for Special keys Keyboard Mic Switch
        $vswc_keyboard_special_key = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key'], 'OtherKey');
        $vswc_keyboard_special_key = self::vswc_sanitize_variable_for_local_script($vswc_keyboard_special_key);

        $vswc_array = array(
            "vswcSelectedLanguage" => self::$vswc_selected_language,
            "vswcImagesPath" => self::$vswc_url . 'images/',
            "_vswcPath" => VSWC_PLUGIN['ABS_URL'],
            "vswcCurrentHostName" => $protocol . $domainName,
            "vswcFloatingMic" => $vswc_floating_mic,
            "vswcSelectedMicPosition" => self::$vswc_floating_mic_position,
            "vswcMicListenTimeoutDuration" => $vswc_mic_listening_timeout,
            "vswcXApiKey" => self::$vswc_api_access_key,
            "_vswcMuteAudioPhrases" => $vswc_mute_audio_phrases,
            "_vswcSingleClick" => $vswc_single_click,
            "_vswcElementor" => $vswc_elementor,
            'vswcKeyboardMicSwitch' => $vswc_keyboard_mic_switch,
            'vswcKeyboardSpecialKey' => $vswc_keyboard_special_key
        );
        wp_localize_script('vswc.text-library', 'vswc', $vswc_array);

        //################################################################################
        //
        // Enqueue 'vswc.speech-handler' javasctipt file to load at front end
        //
        //################################################################################
        wp_enqueue_script(
            'vswc.speech-handler',
            self::vswc_get_file_meta_data('url', 'js/vswc.speech-handler', 'js'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'js/vswc.speech-handler', 'js'),
            true
        );

        //################################################################################
        //
        // Enqueue 'vswc.audio-input-handler' javasctipt file to load at front end
        //
        //################################################################################
        wp_enqueue_script(
            'vswc.audio-input-handler',
            self::vswc_get_file_meta_data('url', 'js/vswc.audio-input-handler', 'js'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'js/vswc.audio-input-handler', 'js'),
            true
        );

        //################################################################################
        //
        // Enqueue 'vdn.audio-recorder' javasctipt file to load at front end
        //
        //################################################################################
        wp_enqueue_script(
            'vswc.audio-recorder',
            self::vswc_get_file_meta_data('url', 'js/recorderjs/vswc.audio-recorder', 'js'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'js/recorderjs/vswc.audio-recorder', 'js'),
            true
        );

        //################################################################################
        //
        // Enqueue 'voice-search-for-woocommerce' javasctipt file to load at front end
        //
        //################################################################################
        wp_enqueue_script(
            'voice-search-for-woocommerce',
            self::vswc_get_file_meta_data('url', 'js/voice-search-for-woocommerce', 'js'),
            array(),
            self::vswc_get_file_meta_data('timestamp', 'js/voice-search-for-woocommerce', 'js'),
            true
        );
    }

    /**
     * Method to add additional link to settings page below plugin on the plugins page.
     */
    function custom_plugin_row_meta($links, $file)
    {
        if (strpos($file, 'voice-search-for-woocommerce.php') !== false) {
            $new_links = array('settings' => '<a href="' . site_url() . '/wp-admin/admin.php?page=voice-search-for-woocommerce-settings" title="Voice Search For WooCommerce">Settings</a>');
            $links = array_merge($links, $new_links);
        }

        return $links;
    }

    /**
     * Class method to get REST API access key ('x-api-key') against license key instate to avail plugin (Voice Search For WooCommerce) service
     *
     * @param $convertable_license_key - String : License key customer posses
     */
    public static function vswc_get_api_key_from_license_key($convertable_license_key = null, $license_key_field_changed = false)
    {
        $result = array();

        try {
            // Throw exception when license key is blank or unavailable
            if (
                !(isset($convertable_license_key) && is_null($convertable_license_key) == false
                    && trim($convertable_license_key) != '')
            ) {
                update_option('vswc_api_system_key', '');
                throw new Exception("Error: License key is unavailable or invalid.");
            }

            $vswc_api_system_key = get_option('vswc_api_system_key', null);
            $vswc_api_system_key = isset($vswc_api_system_key) ? trim($vswc_api_system_key) : null;

            if (!empty($vswc_api_system_key) && $license_key_field_changed === false) {
                self::$vswc_api_access_key = $vswc_api_system_key;
            } else {
                $body = array('license' => trim($convertable_license_key));
                $args = array(
                    'body' => json_encode($body),
                    'timeout' => '60',
                    'headers' => array(
                        'Content-Type' => 'application/json',
                        'Accept' => 'application/json',
                        'x-api-key' => 'jEODHPKy2z7GEIuerFBWk7a0LqVRJ7ER3aDExmbK'
                    )
                );

                $response = wp_remote_post('https://1kosjp937k.execute-api.us-east-1.amazonaws.com/V2', $args);

                // Check the response code
                $response_code = wp_remote_retrieve_response_code($response);

                if ((int) $response_code == 200) {
                    $response_body = wp_remote_retrieve_body($response);
                    $result = @json_decode($response_body, true);

                    if (!empty($result) && is_array($result)) {
                        if (array_key_exists('errorMessage', $result)) {
                            update_option('vswc_api_system_key', '');
                        } else {
                            $conversion_status_code = !empty($result['statusCode']) ? trim($result['statusCode']) : null;
                            ;
                            $conversion_status = !empty($result['status']) ? trim($result['status']) : null;

                            if (
                                !is_null($conversion_status_code) && !is_null($conversion_status)
                                && (int) $conversion_status_code == 200 && strtolower(trim($conversion_status)) == 'success'
                            ) {
                                self::$vswc_api_access_key = !empty($result['key']) ? trim($result['key']) : null;

                                if (self::$vswc_api_access_key !== null) {
                                    update_option('vswc_api_system_key', self::$vswc_api_access_key);
                                } else {
                                    update_option('vswc_api_system_key', '');
                                }
                            } else {
                                update_option('vswc_api_system_key', '');
                            }
                        }
                    }
                }
            }
        } catch (\Exception $ex) {
            self::$vswc_api_access_key = null;
        }

        self::$vswc_api_access_key = self::vswc_sanitize_variable_for_local_script(self::$vswc_api_access_key);
    }

    /**
     * Class method to sanitize empty variables
     *
     * @param $vswc_var - String : Variable to sanitize
     * @return 
     */
    public static function vswc_sanitize_variable_for_local_script($vswc_var = null)
    {
        if (empty($vswc_var)) {
            return null;
        } else {
            return $vswc_var;
        }
    }

    /**
     * Method to log STT service call count to local DB and Cloud
     *
     * @return JSON response obj
     */
    public function vswc_log_service_call()
    {
        check_ajax_referer('service_call_count');

        // Get values from database, HTTP request
        $vswc_do_update_last_value = isset($_REQUEST['updateLastValue']) ? (int) $_REQUEST['updateLastValue'] : 0;
        $vswc_current_value = (int) get_option('vswc_current_value', 0);
        $vswc_last_value = (int) get_option('vswc_last_value', 0);
        $vswc_last_value_updated_at = get_option('vswc_last_value_updated_at', null);
        $vswc_current_value_to_log = ($vswc_do_update_last_value == 1) ? $vswc_current_value : $vswc_current_value + 1;
        $vswc_temp_last_value = get_option('vswc_last_value', null); // To check if we are making initial service log call
        $vswc_log_result = array(
            'vswcSttAccess' => 'allowed',
            'updatedAt' => $vswc_last_value_updated_at,
            'currentValue' => $vswc_current_value,
            'lastValue' => $vswc_last_value
        );

        try {
            // We need to reset current value count to 0 if current count log exceeds 25000
            if ($vswc_current_value_to_log > 25000) {
                update_option('vswc_current_value', 0);
            }

            // Log service count by calling cloud API if last update was before 24 hours or current count is +50 of last count
            if (is_null($vswc_temp_last_value) || $vswc_do_update_last_value === 1 || ($vswc_current_value_to_log > ($vswc_last_value + 50))) {
                $vswc_body = array(
                    'license' => trim(self::$vswc_license_key),
                    'action' => "logCalls",
                    'currentValue' => $vswc_current_value_to_log,
                    'lastValue' => $vswc_last_value,
                );

                $vswc_args = array(
                    'body' => json_encode($vswc_body),
                    'timeout' => '60',
                    'headers' => array(
                        'Content-Type' => 'application/json',
                        'Accept' => 'application/json',
                        'x-api-key' => 'jEODHPKy2z7GEIuerFBWk7a0LqVRJ7ER3aDExmbK'
                    )
                );

                $vswc_response = wp_remote_post('https://1kosjp937k.execute-api.us-east-1.amazonaws.com/V2', $vswc_args);

                // Check the response code
                $vswc_response_code = wp_remote_retrieve_response_code($vswc_response);


                if ($vswc_response_code == 200) {
                    $vswc_response_body = wp_remote_retrieve_body($vswc_response);
                    $vswc_result = @json_decode($vswc_response_body, true);

                    if (!empty($vswc_result) && is_array($vswc_result)) {
                        $log_status = array_key_exists("status", $vswc_result) ? strtolower($vswc_result['status']) : 'failed';
                        $actual_current_value = array_key_exists("current Value", $vswc_result) ? strtolower($vswc_result['current Value']) : null;
                        $vswc_error = array_key_exists("errorMessage", $vswc_result) ? true : false;

                        if ($log_status == 'success' && is_null($actual_current_value) === false && $vswc_error === false) {
                            // Store updated values to database
                            $vswc_current_timestamp = time(); // epoc 
                            update_option('vswc_current_value', $actual_current_value);
                            update_option('vswc_last_value', $actual_current_value);
                            update_option('vswc_last_value_updated_at', $vswc_current_timestamp);

                            // Prepare response 
                            $vswc_log_result['updatedAt'] = $vswc_current_timestamp;
                            $vswc_log_result['currentValue'] = $actual_current_value;
                            $vswc_log_result['lastValue'] = $actual_current_value;
                            $vswc_log_result['cloud'] = true;
                        }
                    }
                }
            } else {
                // Increase current count
                update_option('vswc_current_value', $vswc_current_value_to_log);

                // Prepare response
                $vswc_log_result['currentValue'] = $vswc_current_value_to_log;
                $vswc_log_result['local'] = true;
            }
        } catch (\Exception $ex) {
            // Prepare response 
            $vswc_log_result['vswcSttAccess'] = 'restricted';
        }

        wp_send_json($vswc_log_result);
    }

    /**
     * Method to register plugin for the first time
     *
     */
    public static function vswc_register_plugin()
    {
        try {
            // Get plugin first activation status and license key from DB 
            $vswc_license_key = get_option('vswc_license_key', null);
            $vswc_first_activation = get_option('vswc_first_activation', null);
            $vswc_site_name = sanitize_text_field(isset($_SERVER['HTTP_HOST']) ? $_SERVER['HTTP_HOST'] : $_SERVER['SERVER_NAME']);

            if (empty($vswc_first_activation) && empty(trim($vswc_license_key))) {
                // Mark first activation activity flag in local DB 
                update_option('vswc_first_activation', true); // Store first activation flag in DB

                // Detect site language and set the plugin language
                $vswc_site_language_code = get_locale();
                $vswc_site_language_code = str_replace('_', '-', $vswc_site_language_code);

                if (!empty($vswc_site_language_code) && array_key_exists($vswc_site_language_code, VswcLanguage::get_all_languages())) {
                    update_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['selected_language'], $vswc_site_language_code);
                }

                // Generate UUID and store in DB
                $vswc_new_uuid = wp_generate_uuid4();
                update_option('vswc_uuid', $vswc_new_uuid);

                $vswc_body = array(
                    'action' => 'regVSWC',
                    'url' => $vswc_site_name . '_' . $vswc_new_uuid,
                );

                $vswc_args = array(
                    'body' => json_encode($vswc_body),
                    'timeout' => '60',
                    'headers' => array(
                        'Content-Type' => 'application/json',
                        'Accept' => 'application/json',
                        'x-api-key' => 'jEODHPKy2z7GEIuerFBWk7a0LqVRJ7ER3aDExmbK'
                    )
                );

                $vswc_response = wp_remote_post('https://1kosjp937k.execute-api.us-east-1.amazonaws.com/V2', $vswc_args);

                // Check the response body
                $vswc_response_body = wp_remote_retrieve_body($vswc_response);
                $vswc_result = @json_decode($vswc_response_body, true);

                if (!empty($vswc_result) && is_array($vswc_result)) {
                    $log_status = array_key_exists('status', $vswc_result) ? strtolower(trim($vswc_result['status'])) : null;

                    if ($log_status == '200 success') {
                        // Do nothing for now                       
                    }
                }
            }
        } catch (\Exception $ex) {
            // Do nothing for now               
        }
    }

    /**
     * Method as HTTP request handler to obtain refreshed voice services token and keys
     *
     * @return JSON $vswc_refreshed_keys Containing IBM Watson STT token for now.
     *
     */
    public function vswc_refresh_access_keys()
    {
        check_ajax_referer('keys_refresh');

        self::vswc_synch_voice_access_keys(true);

        $vswc_refreshed_keys = array(
            'gStt' => self::$vswc_voice_services_access_keys['value']['g_stt_key']
        );

        wp_send_json($vswc_refreshed_keys);
    }

    /**
     * Static method to obtain access keys for Google STT & TTS and IBN Watson token
     *
     * @param boolean $forced_synch To by-pass validation to obtain token and keys from API
     *
     */
    public static function vswc_synch_voice_access_keys($forced_synch = false)
    {
        try {
            $vswc_do_synch = false;
            $vswc_g_stt_key = self::$vswc_voice_services_access_keys['value']['g_stt_key'];
            $vswc_g_tts_key = self::$vswc_voice_services_access_keys['value']['g_tts_key'];
            $vswc_synched_at = self::$vswc_voice_services_access_keys['value']['synched_at'];

            if (
                empty($vswc_g_stt_key) ||
                empty($vswc_g_tts_key) ||
                empty($vswc_synched_at) ||
                $forced_synch === true
            ) {
                $vswc_do_synch = true;
            }

            if (!!$vswc_synched_at && $vswc_do_synch === false) {
                $vswc_synched_at_threshold = $vswc_synched_at + (60 * 60 * 6);
                $vswc_current_time = time();

                if ($vswc_current_time > $vswc_synched_at_threshold) {
                    $vswc_do_synch = true;
                }
            }

            if ($vswc_do_synch === false)
                return;

            $vswc_args = array(
                'timeout' => '90',
                'headers' => array(
                    'Content-Type' => 'application/json',
                    'x-api-key' => self::$vswc_api_access_key
                )
            );

            $vswc_response = wp_remote_get(self::$vswc_voice_services_access_keys['api_url'], $vswc_args);

            // Check the response code
            $response_code = wp_remote_retrieve_response_code($vswc_response);

            if ($response_code == 200) {
                $response_body = wp_remote_retrieve_body($vswc_response);
                $vswc_result = @json_decode($response_body, true);

                $vswc_google_stt_key = array_key_exists('gSTT', $vswc_result) ? $vswc_result['gSTT'] : null;
                $vswc_google_tts_key = array_key_exists('TTS', $vswc_result) ? $vswc_result['TTS'] : null;

                /**
                 * Deliberate separation of if blocks, do not merge them for optimization as 
                 * it would ruin the flexibility and independency of response values (none of them depend on each other anyway).
                 *
                 */
                $vswc_synchable_local_keys = 0;

                if (!!$vswc_google_stt_key) {
                    self::$vswc_voice_services_access_keys['value']['g_stt_key'] = $vswc_google_stt_key;
                    $vswc_synchable_local_keys += 1;
                }

                if (!!$vswc_google_tts_key) {
                    self::$vswc_voice_services_access_keys['value']['g_tts_key'] = $vswc_google_tts_key;
                    $vswc_synchable_local_keys += 1;
                }

                if ($vswc_synchable_local_keys > 0) {
                    self::$vswc_voice_services_access_keys['value']['synched_at'] = time();
                    update_option(self::$vswc_voice_services_access_keys['db_col_name'], self::$vswc_voice_services_access_keys['value']);
                }
            }
        } catch (\Exception $ex) {
            // Nullify keys
            self::$vswc_voice_services_access_keys['value']['g_stt_key'] = null;
            self::$vswc_voice_services_access_keys['value']['g_tts_key'] = null;
            self::$vswc_voice_services_access_keys['value']['synched_at'] = null;
        }
    }

}