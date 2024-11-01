<?php
if (!defined('ABSPATH')) exit;

class Voice_Search_For_WooCommerce_Settings_Page
{
    // Database field name map
    const BASIC_CONFIG_OPTION_NAMES = array(
        'license_key'           => 'vswc_license_key',
        'mic_listening_timeout' => 'vswc_mic_listening_timeout',
        'selected_language'     => 'vswc_selected_language',
        'floating_mic'          => 'vswc_floating_mic',
        'floating_mic_position' => 'vswc_floating_mic_position',
        'mute_audio_phrases'    => 'vswc_mute_audio_phrases',
        'single_click'          => 'vswc_single_click',
        'elementor_mic'         => 'vswc_elementor',
        'keyboard_mic_switch'   => 'vswc_keyboard_mic_switch',
        'keyboard_special_key'  => 'vswc_keyboard_special_key'
    );

    private $vswc_license_key           = '';
    private $vswc_mic_listening_timeout = null;
    private $vswc_selected_language     = 'en-US';
    private $vswc_floating_mic          = null;
    private $vswc_floating_mic_position = 'Middle Right';
    private $vswc_all_languages         = array();
    private $vswc_mute_audio_phrases    = null;
    private $vswc_single_click          = null;
    private $vswc_elementor             = null;
    private $vswc_keyboard_mic_switch   = '';
    private $vswc_keyboard_special_key  = 'OtherKey';

    /**
     * Start up
     */
    public function __construct()
    {
        add_action('admin_menu', array($this, 'vswc_add_plugin_page'));
        add_action('admin_init', array($this, 'vswc_page_init'));

        //### THIS FILTERS HOOK INTO A PROCESS BEFORE OPTION GETTING STORED TO DB
        // Register filters for basic config options
        foreach (self::BASIC_CONFIG_OPTION_NAMES as $key => $option) {
            add_filter('pre_update_option_' . $option, array($this, 'vswc_pre_update_basic_config'), 10, 3);
        }

        // Register callback to hook into post create and update (License key) option action
        add_action('add_option_' . self::BASIC_CONFIG_OPTION_NAMES['license_key'], array($this, 'vswc_post_adding_license_key'), 10, 2);
        add_action('update_option_' . self::BASIC_CONFIG_OPTION_NAMES['license_key'], array($this, 'vswc_post_update_license_key'), 10, 2);
    }

    /**
     * Static method to get timestamp from and set timestamp to DB (Timestamp of setting option update)
     *
     * @param $action - string : 'get' or 'set'
     * 
     * $returns $vswc_modified_timestamp - string : Time as a Unix timestamp
     */
    public static function vswc_settings_modified_timestamp($action = null)
    {
        $vswc_modified_timestamp = null;

        try {
            if (empty($action)) return $vswc_modified_timestamp;

            if ($action == 'get') {
                $vswc_modified_timestamp = get_option('vswc_settings_updated_timestamp', null);
            } else if ($action == 'set') {
                $vdn_timestamp = time();
                update_option('vswc_settings_updated_timestamp', $vdn_timestamp);
                $vswc_modified_timestamp = $vdn_timestamp;
            }
        } catch (\Exception $ex) {
            $vswc_modified_timestamp = null;
        }

        return $vswc_modified_timestamp;
    }

    /**
     * Method as callback to handle basic config options data before storing to DB
     *
     * @param $old_value - string : Existing Option value from database
     * @param $new_value - string : New Option value to be stored in database
     * @param $option_name - string : Name of the option
     */
    public function vswc_pre_update_basic_config($new_value, $old_value, $option_name)
    {
        /**
         * Comparing two string values to check if option data modified.
         *
         * Preserve settings updated timestamp 
         */
        if ($old_value != $new_value) {
            $vswc_setting_update_ts = self::vswc_settings_modified_timestamp('set');
            unset($vswc_setting_update_ts);
        }
        if ($option_name == self::BASIC_CONFIG_OPTION_NAMES['selected_language']) {
            self::vswc_inject_short_audio_phrases(trim($new_value));
        }

        return $new_value;
    }

    /**
     * Static method to fetch short audio phrases from 'speak2web.com' and create local audio file for it.
     *
     * @param String  $vswc_lang_code  Language code (eg: en-US)
     *
     */
    public static function vswc_inject_short_audio_phrases($vswc_lang_code)
    {

        $vswc_lang_file_path = $vswc_lang_code . '/' . $vswc_lang_code;
        $vswc_general = VSWC_PLUGIN['ABS_PATH'] . VSWC_PLUGIN['SHORT_PHRASES']['root'] . VSWC_PLUGIN['SHORT_PHRASES']['general'];
        $vswc_random = VSWC_PLUGIN['ABS_PATH'] . VSWC_PLUGIN['SHORT_PHRASES']['root'] . VSWC_PLUGIN['SHORT_PHRASES']['random'];

        // Create 'general' folder
        if (!file_exists($vswc_general . $vswc_lang_code)) {
            $oldmask = umask(0);
            mkdir($vswc_general . $vswc_lang_code, 0777, true);
            umask($oldmask);
        }

        if (!file_exists($vswc_general . $vswc_lang_code . '/lang_mismatch.txt')) {
            touch($vswc_general . $vswc_lang_code . '/lang_mismatch.txt');
        }

        $vswc_general_lang_mismatch = false;

        if (file_exists($vswc_general . $vswc_lang_code) && file_exists($vswc_general . $vswc_lang_code . '/lang_mismatch.txt')) {
            $vswc_general_lang_mismatch = true;
        }

        // Check folder exist with language name in 'general' folder
        if ($vswc_general_lang_mismatch === true) {

            $vswc_general_file_names = array(
                '_basic',
                '_mic_connect',
                '_not_audible',
                '_unavailable'
            );

            $vswc_lang_mismatch = false;

            for ($i = 0; $i < count($vswc_general_file_names); $i++) {
                $vswc_file_name = $vswc_general_file_names[$i];
                $vswc_file_exist = file_exists($vswc_general . $vswc_lang_file_path . $vswc_file_name . '.mp3');
                if (!$vswc_file_exist) {
                    $request = $vswc_general_lang_mismatch === true || !$vswc_file_exist ? wp_remote_get('https://speak2web.com/' . VSWC_PLUGIN['SHORT_PHRASES']['root'] . VSWC_PLUGIN['SHORT_PHRASES']['general'] . $vswc_lang_file_path . $vswc_file_name . '.mp3') : false;
                    if (is_wp_error($request)) {
                        continue;
                    }
                    $vswc_file_data = wp_remote_retrieve_body($request);
                    if ($vswc_file_data !== false) {
                        if ($vswc_file_exist) {
                            unlink($vswc_general . $vswc_lang_file_path . $vswc_file_name . '.mp3');
                        }

                        $vswc_local_file = fopen($vswc_general . $vswc_lang_file_path . $vswc_file_name . '.mp3', "w");

                        if ($vswc_local_file) {
                            // Write contents to the file
                            fwrite($vswc_local_file, $vswc_file_data);

                            // Close the file
                            fclose($vswc_local_file);
                        }
                    } else if (!$vswc_file_exist) {
                        $vswc_src_file = $vswc_general . 'en-US/en-US' . $vswc_file_name . '.mp3';
                        $vswc_dest_file = $vswc_general . $vswc_lang_file_path . $vswc_file_name . '.mp3';
                        copy($vswc_src_file, $vswc_dest_file);

                        if ($vswc_lang_mismatch !== true) {
                            $vswc_lang_mismatch = true;
                        }
                    } else {
                        if ($vswc_lang_mismatch !== true) {
                            $vswc_lang_mismatch = true;
                        }
                    }
                }
            }

            if ($vswc_lang_mismatch === true) {
                $vswc_lang_mismatch = false;

                if ($vswc_general_lang_mismatch === false) {
                    touch($vswc_general . $vswc_lang_code . '/lang_mismatch.txt');
                }
            } else {
                if ($vswc_general_lang_mismatch === true) {
                    unlink($vswc_general . $vswc_lang_code . '/lang_mismatch.txt');
                }
            }
        }

        // Create 'random' folder
        if (!file_exists($vswc_random . $vswc_lang_code)) {
            $oldmask = umask(0);
            mkdir($vswc_random . $vswc_lang_code, 0777, true);
            umask($oldmask);
        }

        if (!file_exists($vswc_random . $vswc_lang_code . '/lang_mismatch.txt')) {
            touch($vswc_random . $vswc_lang_code . '/lang_mismatch.txt');
        }

        $vswc_random_lang_mismatch = false;

        if (file_exists($vswc_random . $vswc_lang_code) && file_exists($vswc_random . $vswc_lang_code . '/lang_mismatch.txt')) {
            $vswc_random_lang_mismatch = true;
        }

        // Check folder exist with language name in 'random' folder
        if ($vswc_random_lang_mismatch === true) {

            $vswc_lang_mismatch = false;

            for ($j = 0; $j < 10; $j++) {
                $vswc_file_name = '_' . $j;
                $vswc_file_exist = file_exists($vswc_random . $vswc_lang_file_path . $vswc_file_name . '.mp3');
                if (!$vswc_file_exist) {
                    $response = $vswc_random_lang_mismatch === true || !$vswc_file_exist  ? wp_remote_get('https://speak2web.com/' . VSWC_PLUGIN['SHORT_PHRASES']['root'] . VSWC_PLUGIN['SHORT_PHRASES']['random'] . $vswc_lang_file_path . $vswc_file_name . '.mp3') : false;
                    if (is_wp_error($request)) {
                        continue;
                    }
                    $vswc_file_data = wp_remote_retrieve_body($request);

                    if ($vswc_file_data !== false) {
                        if ($vswc_file_exist) {
                            unlink($vswc_random . $vswc_lang_file_path . $vswc_file_name . '.mp3');
                        }

                        $vswc_local_file = fopen($vswc_random . $vswc_lang_file_path . $vswc_file_name . '.mp3', "w");

                        if ($vswc_local_file) {
                            // Write contents to the file
                            fwrite($vswc_local_file, $vswc_file_data);

                            // Close the file
                            fclose($vswc_local_file);
                        }
                    } else if (!$vswc_file_exist) {
                        $vswc_src_file = $vswc_random . 'en-US/en-US' . $vswc_file_name . '.mp3';
                        $vswc_dest_file = $vswc_random . $vswc_lang_file_path . $vswc_file_name . '.mp3';
                        copy($vswc_src_file, $vswc_dest_file);

                        if ($vswc_lang_mismatch !== true) {
                            $vswc_lang_mismatch = true;
                        }
                    } else {
                        if ($vswc_lang_mismatch !== true) {
                            $vswc_lang_mismatch = true;
                        }
                    }
                }
            }

            if ($vswc_lang_mismatch === true) {
                $vswc_lang_mismatch = false;

                if ($vswc_random_lang_mismatch === false) {
                    touch($vswc_random . $vswc_lang_code . '/lang_mismatch.txt');
                }
            } else {
                if ($vswc_random_lang_mismatch === true) {
                    unlink($vswc_random . $vswc_lang_code . '/lang_mismatch.txt');
                }
            }
        }
    }


    /**
     * Method for generate files when plugin update
     * 
     * @param string $language
     */
    public static function vswc_generate_short_phrases_on_update($language)
    {
        $plugin_data = get_file_data(VSWC_PLUGIN['ABS_PATH'] . '/voice-search-for-woocommerce.php', [
            'Version' => 'Version'
        ], 'plugin');
        $vswc_version = get_option('vswc_version');
        $vswc_new_version = Voice_Search_For_WooCommerce_Plugin::VSWC_VERSION !== $plugin_data['Version'] ? $plugin_data['Version'] : Voice_Search_For_WooCommerce_Plugin::VSWC_VERSION;
        if ($vswc_version !== $vswc_new_version || $vswc_version === null) {
            update_option('vswc_version', $vswc_new_version);
            self::vswc_inject_short_audio_phrases($language);
        }
    }

    /**
     * Method as callback post to license key option creation in DB
     *
     * @param $option_name - string : Option name
     * @param $option_value - string : Option value
     */
    public function vswc_post_adding_license_key($option_name, $option_value)
    {
        try {
            Voice_Search_For_WooCommerce_Plugin::vswc_get_api_key_from_license_key(trim($option_value), true);

            $vswc_setting_update_ts = self::vswc_settings_modified_timestamp('set');
            unset($vswc_setting_update_ts);
        } catch (\Exception $ex) {
            // Do nothing for now
        }
    }

    /**
     * Method as callback post to license key option update in DB
     *
     * @param $old_value - string : Option value before update
     * @param $new_value - string : Updated Option value
     */
    public function vswc_post_update_license_key($old_value, $new_value)
    {
        try {
            $option_value = strip_tags(stripslashes($new_value));

            if ($old_value != trim($option_value)) {
                Voice_Search_For_WooCommerce_Plugin::vswc_get_api_key_from_license_key(trim($option_value), true);

                $vswc_setting_update_ts = self::vswc_settings_modified_timestamp('set');
                unset($vswc_setting_update_ts);
            }
        } catch (\Exception $ex) {
            // Do nothing for now
        }
    }

    /**
     * Add options page
     */
    public function vswc_add_plugin_page()
    {
        // This page will be under "Settings"
        add_submenu_page(
            'options-general.php', // Parent menu as 'settings'
            'Voice Search For WooCommerce',
            'Voice Search For WooCommerce',
            'manage_options',
            'voice-search-for-woocommerce-settings', // Slug for page
            array($this, 'vswc_settings_create_page') // View 
        );
    }

    /**
     * Options/Settings page callback to create view/html of settings page
     */
    public function vswc_settings_create_page()
    {
        // For license key
        $this->vswc_license_key = strip_tags(stripslashes(get_option(self::BASIC_CONFIG_OPTION_NAMES['license_key'], '')));
        $this->vswc_license_key = !empty($this->vswc_license_key) ? $this->vswc_license_key : '';

        if (empty($this->vswc_license_key)) {
            update_option('vswc_api_system_key', '');
        }

        // For Mic listening auto timeout
        $this->vswc_mic_listening_timeout = strip_tags(stripslashes(get_option(self::BASIC_CONFIG_OPTION_NAMES['mic_listening_timeout'], null)));

        // if voice type is blank then always store voice type as male
        if (empty($this->vswc_mic_listening_timeout) || $this->vswc_mic_listening_timeout < 8) {
            update_option(self::BASIC_CONFIG_OPTION_NAMES['mic_listening_timeout'], 8);
            $this->vswc_mic_listening_timeout = 8;
        } elseif ($this->vswc_mic_listening_timeout > 20) {
            update_option(self::BASIC_CONFIG_OPTION_NAMES['mic_listening_timeout'], 20);
            $this->vswc_mic_listening_timeout = 20;
        }

        // For language
        $this->vswc_selected_language = strip_tags(stripslashes(get_option(
            self::BASIC_CONFIG_OPTION_NAMES['selected_language'],
            'en-US'
        )));

        // For floating mic
        $this->vswc_floating_mic = strip_tags(stripslashes(get_option(self::BASIC_CONFIG_OPTION_NAMES['floating_mic'], null)));

        // For Keyboard Mic Switch
        $this->vswc_keyboard_mic_switch = strip_tags(stripslashes(get_option(
            self::BASIC_CONFIG_OPTION_NAMES['keyboard_mic_switch'],
            ''
        )));

        // For Special keys Keyboard Mic Switch
        $this->vswc_keyboard_special_key = strip_tags(stripslashes(get_option(
            self::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key'],
            'OtherKey'
        )));

        // For Mic Position
        $this->vswc_floating_mic_position = strip_tags(stripslashes(get_option(
            self::BASIC_CONFIG_OPTION_NAMES['floating_mic_position'],
            'Middle Right'
        )));

        $this->vswc_all_languages = VswcLanguage::get_all_languages();
        $this->vswc_all_languages = isset($this->vswc_all_languages) ? $this->vswc_all_languages : array('en-US' => array(VswcLanguage::NAME => 'English (United States)', VswcLanguage::LANG_CODE => 'en-US'));

        // For mute audio phrases
        $this->vswc_mute_audio_phrases = strip_tags(stripslashes(get_option(self::BASIC_CONFIG_OPTION_NAMES['mute_audio_phrases'], null)));
        // For single click
        $this->vswc_single_click = strip_tags(stripslashes(get_option(self::BASIC_CONFIG_OPTION_NAMES['single_click'], null)));
        // For Elementor
        $this->vswc_elementor = strip_tags(stripslashes(get_option(self::BASIC_CONFIG_OPTION_NAMES['elementor_mic'], null)));
?>
        <div class="wrap">
            <div id="vswcavigationSettingsWrapper">
                <div id="vswcavigationSettingsHeader" class="vswc-row">
                    <div class="vswc-setting-header-column-1"><br>
                        <span id="vswcavigationSettingsPageHeading">Voice Search For WooCommerce Setup</span>
                    </div>
                    <div class="vswc-setting-header-column-2">
                        <a title="Wordpress Plugin - speak2web" target="blank" href="https://speak2web.com/plugin/">
                            <img id="vswcavigationSettingsPageHeaderLogo" src="<?php echo esc_url(dirname(plugin_dir_url(__FILE__)) . '/images/speak2web_logo.png') ?>">
                        </a>
                    </div>
                </div>

                <form id="vswcavigationBasicConfigForm" method="post" action="options.php">
                    <?php
                    // This prints out all hidden setting fields
                    settings_fields('vswc-basic-config-settings-group');
                    do_settings_sections('vswc-settings');

                    // To display errors
                    settings_errors('vswc-settings', true, true);
                    ?>
                    <div id="vswcavigationBasicConfigSection" class='vswc-row vswc-card'>
                        <div id="vswcBasicConfHeaderSection" class="vswc-setting-basic-config-column-1 vswc-basic-config-section-title">
                            <table id="vswcavigationBasicConfHeaderTable">
                                <tr>
                                    <th>
                                        <h4><u><?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['basicConfig']['basicConfiguration']); ?></u></h4>
                                    </th>
                                </tr>
                            </table>
                        </div>
                        <div class="vswc-setting-basic-config-column-2">
                            <div class="vswc-basic-config-sub-row">
                                <div><?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['basicConfig']['selectLanguage']); ?>
                                    <select id="vswcLanguage" class="vswc-language" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['selected_language']); ?>">
                                        <?php
                                        foreach ($this->vswc_all_languages as $langCode => $lang) {
                                        ?>
                                            <option <?php selected($langCode, $this->vswc_selected_language); ?> value=<?php echo wp_kses_post($langCode); ?>><?php echo wp_kses_post($lang[VswcLanguage::NAME]); ?>
                                            </option>
                                        <?php
                                        }
                                        ?>
                                    </select>
                                </div>
                            </div>

                            <div class="vswc-basic-config-sub-row">
                                <div id='vswcSubscribe'><?php echo esc_attr(VSWC_LANGUAGE_LIBRARY['basicConfig']['subscribe']); ?><a href="https://speak2web.com/voice-search-for-wordpress-plugin" target="_blank">https://speak2web.com/voice-search-for-wordpress-plugin</a></div>
                                <div class="vswc-basic-config-attached-label-column">License Key</div>
                                <div class="vswc-basic-config-attached-input-column">
                                    <input type="text" name="<?php echo wp_kses_post(self::BASIC_CONFIG_OPTION_NAMES['license_key']); ?>" id="vswcavigationLicenseKey" placeholder="<?php echo esc_attr(VSWC_LANGUAGE_LIBRARY['basicConfig']['copyYourLicenseKey']); ?>" value="<?php echo wp_kses_post($this->vswc_license_key); ?>" />
                                </div>
                                <?php if (strlen($this->vswc_license_key) == 32)
                                    echo "
                                    <script type=\"text/javascript\">
                                    var subscribe_bar = document.getElementById('vswcSubscribe'); 
                                    subscribe_bar.style.display = 'none';
                                    </script>
                                ";
                                ?>
                            </div>
                            <div class="vswc-basic-config-sub-row">
                                <span class="vswc-autotimeout-label">
                                    <label for="vswcAutotimeoutMic">
                                        <?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['basicConfig']['autoTimeoutDuration']); ?>
                                        <input class="vswc-autotimeout-mic" type='number' id='vswcAutotimeoutMic' name="<?php echo wp_kses_post(self::BASIC_CONFIG_OPTION_NAMES['mic_listening_timeout']); ?>" min="8" max="20" step="1" onKeyup="vswcResetTimeoutDefaultValue(this, event)" onKeydown="vswcValidateTimeoutValue(this, event)" value="<?php echo wp_kses_post($this->vswc_mic_listening_timeout); ?>" />
                                    </label>
                                </span>
                            </div>
                            <div class="vswc-basic-config-sub-row">
                                <label for="vswcMuteAudioPhrases">
                                    <input id="vswcMuteAudioPhrases" type='checkbox' name="<?php echo wp_kses_post(self::BASIC_CONFIG_OPTION_NAMES['mute_audio_phrases']); ?>" value="yes" <?php checked('yes', $this->vswc_mute_audio_phrases); ?>> <?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['basicConfig']['muteAudioPhrases']); ?>
                                </label>
                            </div>
                            <!-- Floating Mic Position -->
                            <div class="vswc-basic-config-sub-row">
                                <div class="vswc-dotted-border">
                                    <b><?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['basicConfig']['floatingMicOptions']); ?></b>
                                    <hr>
                                    <div class="vswc-basic-config-sub-row">
                                        <label for="vswcFloatingMicPosition">
                                            <?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['basicConfig']['selectFloatingMicPosition']); ?>
                                            <select id="vswcFloatingMicPosition" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['floating_mic_position']); ?>">
                                                <option value="Middle Right" <?php selected('Middle Right', $this->vswc_floating_mic_position); ?>>Middle Right</option>
                                                <option value="Middle Left" <?php selected('Middle Left', $this->vswc_floating_mic_position); ?>>Middle Left</option>
                                                <option value="Top Right" <?php selected('Top Right', $this->vswc_floating_mic_position); ?>>Top Right</option>
                                                <option value="Top Left" <?php selected('Top Left', $this->vswc_floating_mic_position); ?>>Top Left</option>
                                                <option value="Bottom Right" <?php selected('Bottom Right', $this->vswc_floating_mic_position); ?>>Bottom Right</option>
                                                <option value="Bottom Left" <?php selected('Bottom Left', $this->vswc_floating_mic_position); ?>>Bottom Left</option>
                                            </select>
                                        </label>
                                    </div>
                                    <div class="vswc-basic-config-sub-row">
                                        <label for="vswcFloatingMic">
                                            <input id="vswcFloatingMic" type='checkbox' name="<?php echo wp_kses_post(self::BASIC_CONFIG_OPTION_NAMES['floating_mic']); ?>" value="yes" <?php checked('yes', $this->vswc_floating_mic); ?>> <?php echo wp_kses_post(VSWC_LANGUAGE_LIBRARY['basicConfig']['floatingMic']); ?>
                                        </label>
                                    </div>
                                    <div class="vswc-basic-config-sub-row">
                                        <label for="vswcSingleClick">
                                            <input id="vswcSingleClick" type='checkbox' name="<?php echo wp_kses_post(self::BASIC_CONFIG_OPTION_NAMES['single_click']); ?>" value="yes" <?php checked('yes', $this->vswc_single_click); ?>> Enable single click transcription.
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <!-- END Floating Mic Position -->
                            <div class="vswc-basic-config-sub-row">
                                <div class="vswc-dotted-border">
                                    <strong>Trigger STT Mic Using Key</strong><br>
                                    <hr>
                                    <p style="color: gray;"><b style="color: blue;">&#x2139; </b>To trigger STT mic, press selected key two times.</p>
                                    <label for="vswcSpecialKeyAlt" style="margin-right: 8px; margin-top: 5px;">
                                        <input type="radio" id="vswcSpecialKeyAlt" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key']); ?>" value="Alt" onclick="vswctoggleInputFieldOtherKey('Alt')" <?php checked('Alt', $this->vswc_keyboard_special_key); ?>>
                                        Alt
                                    </label>
                                    <label for="vswcSpecialKeyCtrl" style="margin-right: 8px;">
                                        <input type="radio" id="vswcSpecialKeyCtrl" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key']); ?>" value="Control" onclick="vswctoggleInputFieldOtherKey('Control')" <?php checked('Control', $this->vswc_keyboard_special_key); ?>>
                                        Ctrl
                                    </label>
                                    <label for="vswcSpecialKeyShift" style="margin-right: 8px;">
                                        <input type="radio" id="vswcSpecialKeyShift" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key']); ?>" value="Shift" onclick="vswctoggleInputFieldOtherKey('Shift')" <?php checked('Shift', $this->vswc_keyboard_special_key); ?>>
                                        Shift
                                    </label>
                                    <label for="vswcSpecialKeySpace" style="margin-right: 8px;">
                                        <input type="radio" id="vswcSpecialKeySpace" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key']); ?>" value="Space" onclick="vswctoggleInputFieldOtherKey('Space')" <?php checked('Space', $this->vswc_keyboard_special_key); ?>>
                                        Space
                                    </label>
                                    <label for="vswcSpecialKeyOtherKey">
                                        <input type="radio" id="vswcSpecialKeyOtherKey" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key']); ?>" value="OtherKey" onclick="vswctoggleInputFieldOtherKey('OtherKey')" <?php checked('OtherKey', $this->vswc_keyboard_special_key); ?>>
                                        OtherKey
                                    </label>
                                    <label for="vswcKeyBoardSwitch" class="vswcShowOtherInput vswc-hide"><br><br>
                                        <b>Key<span class="vswc-important">*</span> :</b>
                                        <input type="text" maxlength="1" placeholder="a - z" oninput="vswcValidateValueForOtherKey(this, event)" name="<?php echo esc_attr(self::BASIC_CONFIG_OPTION_NAMES['keyboard_mic_switch']); ?>" id="vswcKeyBoardSwitch" value="<?php echo esc_attr($this->vswc_keyboard_mic_switch); ?>">
                                    </label>
                                    <div class="vswcWarningInputKey"></div>
                                </div>
                            </div>
                            <div class="vswc-basic-config-sub-row">
                                <div class="vswc-dotted-border">
                                    <strong>Elementor Settings</strong>
                                    <hr>
                                    <div>
                                        <label for="vswcElementorSettings">
                                            <input id="vswcElementorSettings" type='checkbox' name="<?php echo wp_kses_post(self::BASIC_CONFIG_OPTION_NAMES['elementor_mic']); ?>" value='yes' <?php checked('yes', $this->vswc_elementor); ?>> Enable Elementor.
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div class="vswc-setting-basic-config-column-3 vswc-basic-config-sub-row">
                            <?php
                            $other_attributes = array('id' => 'vswcavigationBasicConfigSettingsSave');
                            submit_button(
                                VSWC_LANGUAGE_LIBRARY['basicConfig']['saveSettings'],
                                'primary',
                                'vswc-basic-config-settings-save',
                                false,
                                $other_attributes
                            );
                            ?>
                        </div>
                    </div>
                </form>
            </div>
        </div>
<?php
    }

    /**
     * Register and add settings
     */
    public function vswc_page_init()
    {
        // Register settings for feilds of 'Basic Configuration' section
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['license_key']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['mic_listening_timeout']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['selected_language']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['floating_mic']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['floating_mic_position']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['mute_audio_phrases']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['single_click']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['elementor_mic']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['keyboard_special_key']);
        register_setting('vswc-basic-config-settings-group', self::BASIC_CONFIG_OPTION_NAMES['keyboard_mic_switch']);
    }
}

// check user capabilities and hook into 'init' to initialize 'Voice Search For WooCommerce' settings object
add_action('init', 'initialize_vswc_settings_object');

/**
 * Initialize 'Voice Search For WooCommerce' settings object when 'pluggable' files are loaded from '/wp-includes/pluggable'
 * Which contains 'current_user_can' function.
 */
function initialize_vswc_settings_object()
{
    if (!current_user_can('manage_options')) return;

    $voice_search_for_woocommerce_settings_page = new Voice_Search_For_WooCommerce_Settings_Page();
}
