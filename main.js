require.config({
    baseUrl: 'src',
    paths: {
        // Patternslib core dependencies
        'jquery':                       'bower_components/jquery/dist/jquery',
        'jquery.browser':               'bower_components/jquery.browser/dist/jquery.browser',
        'logging':                      'bower_components/logging/src/logging',
        'pat-base':                     'bower_components/patternslib/src/core/base',
        'pat-compat':                   'bower_components/patternslib/src/core/compat',
        'pat-jquery-ext':               'bower_components/patternslib/src/core/jquery-ext',
        'pat-logger':                   'bower_components/patternslib/src/core/logger',
        'pat-mockup-parser':            'bower_components/patternslib/src/core/mockup-parser',
        'pat-parser':                   'bower_components/patternslib/src/core/parser',
        'pat-registry':                 'bower_components/patternslib/src/core/registry',
        'pat-utils':                    'bower_components/patternslib/src/core/utils',
        // Extra dependencies
        'domurl':                       'bower_components/domurl/url',
        'mockup-i18n':                  'bower_components/mockup/mockup/js/i18n',
        'mockup-utils':                 'bower_components/mockup/mockup/js/utils',
        'modernizr':                    'bower_components/modernizr/modernizr',
        'translate':                    'bower_components/mockup/mockup/js/i18n-wrapper',
        'underscore':                   'bower_components/underscore/underscore'
    },
    'shim': {
        'logging': { 'exports': 'logging' }
    }
});

require(['jquery', 'pat-registry', 'pat-fancyoverlay'], function($, registry, pattern) {
    window.patterns = registry;
    $(document).ready(function() {
        registry.init();
    });
});
