<?php
/**
 * Plugin Name: Voice Search For WooCommerce
 * Description: Allows any serach box on the page to be searchable via voice.
 * Version:     2.1.0
 * Author:      speak2web
 * Author URI:  https://speak2web.com/
 * Text Domain: voice-search-for-woocommerce
 * Domain Path: /languages
 * WC requires at least: 2.2
 * WC tested up to: 7.8.2
 */

/**
 * Copyright (c) 2021 speak2web
 *
 * Voice Search For WooCommerce is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2 or, at
 * your discretion, any later version, as published by the Free
 * Software Foundation.
 *
 * Voice Search For WooCommerce is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Voice Search For WooCommerce; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA  02110-1301  USA
 */

defined('WPINC') or die;

include(dirname(__FILE__) . '/lib/requirements-check.php');

$voice_search_for_woocommerce_requirements_check = new Voice_Search_For_WooCommerce_Requirements_Check(
    array(
        'title' => 'Voice Search For WooCommerce',
        'php' => '5.3',
        'wp' => '2.6',
        'file' => __FILE__,
    )
);

class Vswc_Elementor_widget
{

    private static $instance = null;


    public static function instance()
    {
        if (is_null(self::$instance)) {
            self::$instance = new self();
        }

        return self::$instance;
    }


    private function include_widgets_files()
    {
        require_once(__DIR__ . '/widgets/oembed-widget.php');
    }

    public function register_widgets()
    {
        // It's now safe to include Widgets files.
        $this->include_widgets_files();

        // Register the plugin widget classes.
        \Elementor\Plugin::instance()->widgets_manager->register(new \Vswc_Elementor_Floating_Mic_Widget());
    }

    public function register_categories($elements_manager)
    {
        $elements_manager->add_category(
            'speak2web',
            [
                'title' => __('Speak2web', 'myWidget'),
                'icon' => 'fa fa-plug'
            ]
        );
    }

    public function __construct()
    {
        // Register the widgets.
        add_action('elementor/widgets/register', array($this, 'register_widgets'));
        add_action('elementor/elements/categories_registered', array($this, 'register_categories'));

    }
}
Vswc_Elementor_widget::instance();

if ($voice_search_for_woocommerce_requirements_check->passes()) {
    $vswc_client_info = array(
        'chrome' => false,
        'firefox' => false,
        'edge' => false,
        'ie' => false,
        'macSafari' => false,
        'iosSafari' => false,
        'opera' => false
    );

    // Chrome
    if (stripos($_SERVER['HTTP_USER_AGENT'], 'chrome') !== false) {
        $vswc_client_info['chrome'] = true;
    }

    // Firefox
    if (stripos($_SERVER['HTTP_USER_AGENT'], 'firefox') !== false) {
        $vswc_client_info['firefox'] = true;
    }

    // Edge
    if (stripos($_SERVER['HTTP_USER_AGENT'], 'edge') !== false || stripos($_SERVER['HTTP_USER_AGENT'], 'edg') !== false) {
        $vswc_client_info['edge'] = true;
    }

    // IE
    if (stripos($_SERVER['HTTP_USER_AGENT'], 'msie') !== false || stripos($_SERVER['HTTP_USER_AGENT'], 'trident') !== false) {
        $vswc_client_info['ie'] = true;
    }

    // Mac Safari
    if (stripos($_SERVER['HTTP_USER_AGENT'], 'macintosh') !== false && stripos($_SERVER['HTTP_USER_AGENT'], 'chrome') === false && stripos($_SERVER['HTTP_USER_AGENT'], 'safari') !== false) {
        $vswc_client_info['macSafari'] = true;
    }

    // iOS
    if ((stripos($_SERVER['HTTP_USER_AGENT'], 'iphone') !== false || stripos($_SERVER['HTTP_USER_AGENT'], 'ipad') !== false || stripos($_SERVER['HTTP_USER_AGENT'], 'ipod') !== false) && stripos($_SERVER['HTTP_USER_AGENT'], 'safari') !== false) {
        $vswc_client_info['iosSafari'] = true;
    }

    // Opera
    if (stripos($_SERVER['HTTP_USER_AGENT'], 'opera') !== false || stripos($_SERVER['HTTP_USER_AGENT'], 'opr') !== false) {
        $vswc_client_info['opera'] = true;
    }

    if ($vswc_client_info['chrome'] === true && ($vswc_client_info['opera'] === true || $vswc_client_info['edge'] === true)) {
        $vswc_client_info['chrome'] = false;
    }

    define('VSWC_CLIENT', $vswc_client_info);

    // To get all active plugins.
    $vswc_all_active_plugins = (array) null;

    // Get selected language from DB and load local translation library
    $vswc_selected_language = get_option('vswc_selected_language', 'en-US');
    $vswc_selected_language = empty($vswc_selected_language) ? 'en-US' : trim($vswc_selected_language);
    $vswc_language_file_name = $vswc_selected_language == 'de-DE' ? 'vswc_de_DE' : 'vswc_en_EN';
    include(dirname(__FILE__) . '/classes/plugin-languages/' . $vswc_language_file_name . '.php');

    try {
        switch ($vswc_selected_language) {
            case 'de-DE':
                define('VSWC_LANGUAGE_LIBRARY', vswc_de_DE::VSWC_LANGUAGE_LIB);
                break;
            default:
                define('VSWC_LANGUAGE_LIBRARY', vswc_en_EN::VSWC_LANGUAGE_LIB);
        }
    } catch (\Exception $e) {
        // Do nothing for now
    }

    define('VSWC_PLUGIN', array(
        'ABS_PATH' => plugin_dir_path(__FILE__),
        'ABS_URL' => plugin_dir_url(__FILE__),
        'BASE_NAME' => plugin_basename(__FILE__),
        'SHORT_PHRASES' => array('root' => 'short_phrases/', 'general' => 'general/', 'random' => 'random/')
    )
    );

    // Pull in the plugin classes and initialize
    include(dirname(__FILE__) . '/lib/wp-stack-plugin.php');
    include(dirname(__FILE__) . '/classes/vswc-admin-notices.php');
    include(dirname(__FILE__) . '/classes/languages/languages.php');
    include(dirname(__FILE__) . '/classes/plugin.php');
    include(dirname(__FILE__) . '/classes/settings-page.php');

    Voice_Search_For_WooCommerce_Plugin::start(__FILE__);

    // Inline plugin notices
    $path = plugin_basename(__FILE__);

    // Hook into plugin activation
    register_activation_hook(__FILE__, function () {
        $vswc_setting_update_ts = Voice_Search_For_WooCommerce_Settings_Page::vswc_settings_modified_timestamp('set');
        unset($vswc_setting_update_ts);

        // Get active plugins
        $vswc_all_active_plugins = get_option('active_plugins');

        // Get higher version active plugins path
        $wcva_path = vswc_get_active_plugin_path('voice-shopping-for-woocommerce', $vswc_all_active_plugins);
        $vdn_path = vswc_get_active_plugin_path('voice-dialog-navigation', $vswc_all_active_plugins);
        $dvc_path = vswc_get_active_plugin_path('dynamic-voice-command', $vswc_all_active_plugins);
        $vf_path = vswc_get_active_plugin_path('voice-forms', $vswc_all_active_plugins);
        $uvs_path = vswc_get_active_plugin_path('universal-voice-search', $vswc_all_active_plugins);

        $vswc_plugin_url = plugin_dir_url(__FILE__);

        // Deactivate 'Universal Voice Search' Plugin
        if (!empty($uvs_path) && is_plugin_active($uvs_path)) {
            deactivate_plugins($uvs_path);
        }

        // Display activation denied notice and stop activating this plugin
        if (
            (!empty($wcva_path) && is_plugin_active($wcva_path))
            || (!empty($vdn_path) && is_plugin_active($vdn_path))
            || (!empty($dvc_path) && is_plugin_active($dvc_path))
            || (!empty($vf_path) && is_plugin_active($vf_path))
        ) {
            wp_die(Vswc_Admin_Notices::vswc_denied_activation_notice($vswc_plugin_url));
        }

        //###########################################################################################################################################
        // Transition code to preserve admin's language choice before upgrading/updating to additional 130 language support feature 
        // 
        // Here admin's language choice is check against fallback array which maps the old way of storing language name as value with language code
        //###########################################################################################################################################
        $vswc_selected_language = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['selected_language'], 'en-US');
        $vswc_selected_language = isset($vswc_selected_language) && !empty($vswc_selected_language) ? $vswc_selected_language : 'en-US';
        $vswc_lang_code = 'en-US';

        if (in_array($vswc_selected_language, Voice_Search_For_WooCommerce_Plugin::$vswc_fallback_lang_map)) {
            $vswc_lang_code = array_search($vswc_selected_language, Voice_Search_For_WooCommerce_Plugin::$vswc_fallback_lang_map);
            update_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['selected_language'], $vswc_lang_code);
        } else {
            $vswc_lang_code = $vswc_selected_language;
        }

        // Register plugin
        Voice_Search_For_WooCommerce_Plugin::vswc_register_plugin();

        $vswc_general = VSWC_PLUGIN['ABS_PATH'] . VSWC_PLUGIN['SHORT_PHRASES']['root'] . VSWC_PLUGIN['SHORT_PHRASES']['general'];

        // Get language from database as 'Voice_Search_For_WooCommerce_Plugin::vswc_register_plugin()' could have set auto detected language
        $vswc_lang_code = get_option(Voice_Search_For_WooCommerce_Settings_Page::BASIC_CONFIG_OPTION_NAMES['selected_language'], 'en-US');

        if (!file_exists($vswc_general . $vswc_lang_code)) {
            Voice_Search_For_WooCommerce_Settings_Page::vswc_inject_short_audio_phrases($vswc_lang_code);
        }
    });

    /**
     * Function to get path of active plugin
     *
     * @param $vswc_plugin_file_name  String  Name of the plugin file (Without extension)
     * @param $vswc_active_plugins  Array  Array of active plugins path
     *
     * @return $vswc_active_plugin_path  String  Path of active plugin otherwise NULL
     *
     */
    function vswc_get_active_plugin_path($vswc_plugin_file_name = "", $vswc_active_plugins = array())
    {
        $vswc_active_plugin_path = null;

        try {
            if (!!$vswc_active_plugins && !!$vswc_plugin_file_name) {
                $vswc_plugin_file_name = trim($vswc_plugin_file_name);

                foreach ($vswc_active_plugins as $key => $active_plugin) {
                    $plugin_name_pos = stripos($active_plugin, $vswc_plugin_file_name . ".php");

                    if ($plugin_name_pos !== false) {
                        $vswc_active_plugin_path = $active_plugin;
                        break;
                    }
                }
            }
        } catch (\Exception $ex) {
            $vswc_active_plugin_path = null;
        }

        return $vswc_active_plugin_path;
    }

    // Define the uninstall function
    function vswc_remove_version_from_db()
    {
        delete_option('vswc_version');
    }
    // Register the uninstall hook
    register_uninstall_hook(__FILE__, 'vswc_remove_version_from_db');

}

unset($voice_search_for_woocommerce_requirements_check);