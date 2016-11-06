/* Modal pattern.
 *
 * Options:
 *    ajaxLoad(boolean): Load content with ajax_load request parameter set. (true)
 *
 * Documentation:
 *    # Example
 *
 *    {{ example-basic }}
 *
 * Example: example-basic
 *    <a href="#modal1" class="plone-btn plone-btn-large plone-btn-primary pat-plone-modal"
 *                      data-pat-plone-modal="width: 400">Modal basic</a>
 *    <div id="modal1" style="display: none">
 *      <h1>Basic modal!</h1>
 *      <p>Indeed. Whoa whoa whoa whoa. Wait.</p>
 *    </div>
 *
 */

define([
    'jquery',
    'underscore',
    'pat-base',
    'pat-registry',
    'pat-parser',
    'mockup-utils',
    'text!pat-fancyoverlay-url/template.xml',
    'translate',
    'jquery.form',
    'modernizr'
], function($, _, Base, registry, Parser, utils, modalTemplate, _t) {

    'use strict';

    var parser = new Parser('fancyoverlay');

    // different modal modes
    parser.addArgument('ajaxUrl', undefined);  // AJAX Url
    parser.addArgument('target', undefined);   // If set, the value will be used as selector to find the modal's contents.
    parser.addArgument('html', undefined);     // If set, the value will be used as HTML string content for the modal.
    parser.addArgument('image', undefined);    // If set to true, then the anchor's href attribute will be used as image source.

    // ajax mode
    parser.addArgument('ajaxContentFilterSelector', '#content');
    parser.addArgument('ajaxExtraParameter', {'ajax_load': 1});  // extra url parameters for ajax loading

    // content
    parser.addArgument('buttons', '.formControls > input[type="submit"]');
    parser.addArgument('buttonsCancel', '#form-buttons-cancel');
    parser.addArgument('prependContent', '.portalMessage');
    parser.addArgument('prependHeader', '.documentFirstHeading, #content-core > p.discreet, .linkModal > h1, .linkModal p.info');
    parser.addArgument('cssclasses', undefined);  // Extra CSS classes for the overlay
    parser.addArgument('title', undefined);  // Title for the overlay

    // action options
    parser.addArgument('timeout', false);
    parser.addArgument('error', '.portalMessage.error');
    parser.addArgument('formFieldError', '.field.error');
    parser.addArgument('displayInModal', undefined);
    parser.addArgument('redirectOnResponse', false);
    parser.addArgument('redirectToUrl', undefined);
    parser.addArgument('reloadWindowOnClose', false);
    
    parser.addArgument('transitionStyle', undefined);

    var Modal = Base.extend({
        name: 'fancyoverlay',
        trigger: '.pat-fancyoverlay',
        parser: 'mockup',

        createModal: null,
        loading: null,

        // transition setup
        transEndEventName: {
            'WebkitTransition': 'webkitTransitionEnd',
            'MozTransition': 'transitionend',
            'OTransition': 'oTransitionEnd',
            'msTransition': 'MSTransitionEnd',
            'transition': 'transitionend'
        }[Modernizr.prefixed('transition')],
        browserSupport: {transitions: Modernizr.csstransitions},

        origBodyOverflow: 'auto',

        reloadWindow: function() {
            window.parent.location.reload();
        },
        init: function() {
            this.options = $.extend(
                true,
                {},
                parser.parse(this.$el),
                this.options
            );
            this.$el.on('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                this.createModal();
            }.bind(this));
            this.loading = new utils.Loading();
            this.initModal();
        },

        createAjaxModal: function() {
            this.emit('before-ajax');
            this.loading.show();
            this.ajaxXHR = $.ajax({
                url: this.makeAjaxUrl(this.options.ajaxUrl)
            }).done(function(response, textStatus, xhr) {
                this.ajaxXHR = undefined;
                this.$raw = $('<div />').append($(utils.parseBodyTag(response)));
                this.emit('after-ajax', this, textStatus, xhr);
                this._show();
            }.bind(this)).fail(function(xhr, textStatus, errorStatus) {
                window.alert(_t('There was an error loading modal.'));
                this.hide();
                this.emit('linkActionError', [xhr, textStatus, errorStatus]);
            }.bind(this)).always(function() {
                this.loading.hide();
            }.bind(this));
        },

        createBasicModal: function() {
            this.$raw = $('<div/>').html(this.$el.clone());
            this._show();
        },

        createHtmlModal: function() {
            this.$raw = $(this.options.html);
            this._show();
        },

        createTargetModal: function() {
            this.$raw = $(this.options.target).clone();
            this._show();
        },

        createImageModal: function() {
            var src = this.options.image;
            this.$raw = $('<div><h1>Image</h1><div id="content"><div class="modal-image"><img src="' + src + '" /></div></div></div>');
            this._show();
        },

        initModal: function() {
            var url = this.$el.attr('href') || '';
            if (this.options.html) {
                // mode html
                this.createModal = this.createHtmlModal;
            } else if (this.options.target || url.substr(0, 1) === '#') {
                // mode target
                if (!this.options.target) {
                    this.options.target = url;
                }
                this.createModal = this.createTargetModal;
            } else if (this.options.image || (
                    this.endsWith(url, '.jpg') ||
                    this.endsWith(url, '.jpeg') ||
                    this.endsWith(url, '.png') ||
                    this.endsWith(url, '.gif')
            )) {
                // mode image
                if (!this.options.image) {
                    this.options.image = url;
                }
                this.createModal = this.createImageModal;
            } else if (this.options.ajaxUrl || url) {
                // mode ajax
                if (!this.options.ajaxUrl) {
                    this.options.ajaxUrl = url;
                }
                this.createModal = this.createAjaxModal;
            } else {
                // mode basic
                this.createModal = this.createBasicModal;
            }
        },

        render: function() {
            this.emit('before-render');

            if (!this.$raw) {
                return;
            }
            var $raw = this.$raw.clone();
            // fix for IE9 bug (see http://bugs.jquery.com/ticket/10550)
            $('input:checked', $raw).each(function() {
                if (this.setAttribute) {
                    this.setAttribute('checked', 'checked');
                }
            });

            // Object that will be passed to the template
            var templateOptions = {
                header: '',
                prepend: '',
                content: '',
                buttons: '<div class="fancyoverlay-buttons plone-modal-footer"></div>',
                cssclasses: this.options.cssclasses,
                title: this.options.title
            };

            // Grab items to insert into the header area
            if (this.options.prependHeader) {
                $(this.options.prependHeader, $raw).each(function () {
                    var $el = $(this);
                    templateOptions.header += $('<div />').append($el.clone()).html();
                    $el.remove();
                });
            }

            // Grab items to insert into the prepend area
            if (this.options.prependContent) {
                $(this.options.prependContent, $raw).each(function () {
                    var $el = $(this);
                    templateOptions.prepend += $('<div />').append($el.clone()).html();
                    $el.remove();
                });
            }

            if (this.options.ajaxUrl && this.options.ajaxContentFilterSelector) {
                // Filter out the content if there is a selector provided and we're in ajax mode.
                // Use raw as fallback, if selector not present
                templateOptions.content = $(this.options.ajaxContentFilterSelector, $raw).html() || $raw.html();
            } else {
                templateOptions.content = $raw.html();
            }

            // Render html
            var $modal = this.$modal = $(_.template(modalTemplate)(templateOptions));


            // In most browsers, when you hit the enter key while a form element is focused
            // the browser will trigger the form 'submit' event.  Google Chrome also does this,
            // but not when when the default submit button is hidden with 'display: none'.
            // The following code will work around this issue:
            $('form', this.$modal).on('keydown', function(event) {
                // ignore keys which are not enter, and ignore enter inside a textarea.
                if (event.keyCode !== 13 || event.target.nodeName === 'TEXTAREA') {
                    return;
                }
                event.preventDefault();
                $('input[type=submit], button[type=submit], button:not(type)', this).eq(0).trigger('click');
            });

            // Setup buttons
            $(this.options.buttons, this.$modal).each(function() {
                var $button = $(this);
                $button
                  .on('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                })
                  .clone()
                  .appendTo($('.fancyoverlay-buttons', $modal))
                  .off('click').on('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();
                    $button.trigger('click');
                });
                $button.hide();
            });

            this.emit('before-events-setup');

            // INIT FORM
            this.form();

            // CLOSE modal
            $('.fancyoverlay-close', this.$modal)
              .off('click')
              .on('click', function(e) {
                e.stopPropagation();
                e.preventDefault();

                var cancelbutton = $(this.options.buttonsCancel, this.$raw);
                if (cancelbutton.length) {
                    // submit the cancel action and close afterwards.
                    // prevents contents being left in "locked" state.
                    this.loading.show(false);
                    this.handleFormAction($(cancelbutton[0]));
                } else {
                    this.$modal.trigger('destroy.patterns.fancyoverlay');
                }

            }.bind(this));

            this.$modal.on('destroy.patterns.fancyoverlay', function(e) {
                e.stopPropagation();
                this.hide();
            }.bind(this));

            this.$modal.appendTo($('body'));

            this.emit('after-render');
        },

        show: function() {
            // support plone-modal API
            this.createModal();
        },

        _show: function() {
            // don't show body scrollbars when overlay is open
            this.origBodyOverflow = $('body').css('overflow');
            $('body').css('overflow', 'hidden');

            this.render();
            this.emit('show');
            this.loading.hide();
            this.$el.addClass('open');
            this.$modal.addClass('open');
            registry.scan(this.$modal);
            this.emit('shown');
        },

        hide: function() {
            if (this.ajaxXHR) {
                this.ajaxXHR.abort();
            }
            if (this._suppressHide) {
                if (!window.confirm(this._suppressHide)) {
                    return;
                }
            }

            // start closing
            this.emit('hide');
            this.loading.hide();

            var onEndTransitionFn = function(ev) {
                if (this.options.transitionStyle && this.browserSupport.transitions) {
                    if (ev.propertyName !== 'visibility') {
                        return;
                    }
                    this.$modal[0].removeEventListener(this.transEndEventName, onEndTransitionFn);
                }
                if (this.$modal !== undefined) {
                    this.$modal.removeClass('close');
                    this.$modal.remove();
                }
            }.bind(this);

            this.$modal.removeClass('open');
            this.$modal.addClass('close');
            if (this.options.transitionStyle && this.browserSupport.transitions) {
                this.$modal[0].addEventListener(this.transEndEventName, onEndTransitionFn);
            } else {
                onEndTransitionFn();
            }

            // show original overlay value on body after closing
            $('body').css('overflow', this.origBodyOverflow);

            this.$el.removeClass('open');
            this.emit('hidden');
        },

        redraw: function(response) {
            this.emit('beforeDraw');
            this.$modal.remove();
            this.$raw = $('<div />').append($(utils.parseBodyTag(response)));
            this.render();
            this.$modal.addClass('open');
            registry.scan(this.$modal);
            this.emit('afterDraw');
        },

        form: function() {
            var that = this;

            $(this.options.buttons, this.$modal).each(function() {
                var $action = $(this);
                $action.on('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    that.loading.show(false);

                    if (this.tagName.toLowerCase() === 'input' || this.tagName.toLowerCase() === 'button') {
                        that.handleFormAction($action);
                    // handle event on link with jQuery.ajax
                    } else if ($action.attr('href')) {
                        that.handleLinkAction($action);
                    }

                });
            });
        },

        handleFormAction: function($action) {
            var isCancel = $action.is(this.options.buttonsCancel);

            var extraData = {};
            extraData[$action.attr('name')] = $action.attr('value');

            var $form = $action.closest('form');
            var url = this.makeAjaxUrl($form.attr('action'));

            // We want to trigger the form submit event but NOT use the default
            $form.on('submit', function(e) {
                e.preventDefault();
            });
            $form.trigger('submit');

            $form.ajaxSubmit({
                timeout: this.options.timeout,
                data: extraData,
                url: url,
                error: function(xhr, textStatus, errorStatus) {
                    this.loading.hide();
                    window.alert(_t('There was an error submitting the form.'));
                    this.emit('formActionError', [xhr, textStatus, errorStatus]);
                }.bind(this),
                success: function(response, state, xhr, form) {
                    this.loading.hide();
                    // if error is found (NOTE: check for both the portal errors
                    // and the form field-level errors)
                    if ($(this.options.error, response).size() !== 0 ||
                        $(this.options.formFieldError, response).size() !== 0) {
                        this.redraw(response);
                        return;
                    }

                    if (!isCancel && this.options.redirectOnResponse === true) {
                        if (this.options.redirectToUrl) {
                            // use parameter
                            window.parent.location.href = this.options.redirectToUrl;
                        } else {
                            // use function
                            window.parent.location.href = this.redirectToUrl(response);
                        }
                        return; // cut out right here since we're changing url
                    }

                    if (this.options.displayInModal === true) {
                        this.redraw(response);
                    } else {
                        // also calls hide
                        this.$modal.trigger('destroy.patterns.fancyoverlay');
                        if (!isCancel && this.options.reloadWindowOnClose) {
                            this.reloadWindow();
                        }
                    }
                    this.emit('formActionSuccess', [response, state, xhr, form]);
                }.bind(this)
            });
        },

        handleLinkAction: function($action) {
            var url = $action.attr('href');

            // Non-ajax link
            if (this.options.displayInModal === false) {
                if ($action.attr('target') === '_blank') {
                    window.open(url, '_blank');
                    this.loading.hide();
                } else {
                    window.location = url;
                }
                return;
            }

            // ajax version
            $.ajax({
                url: this.makeAjaxUrl(url)
            }).fail(function(xhr, textStatus, errorStatus) {
                window.alert(_t('There was an error loading modal.'));
                this.emit('linkActionError', [xhr, textStatus, errorStatus]);
            }.bind(this)).done(function(response, state, xhr) {
                this.redraw(response);
                this.emit('linkActionSuccess', [response, state, xhr]);
            }.bind(this)).always(function() {
                this.loading.hide();
            }.bind(this));
        },

        redirectToUrl: function(response) {
            var reg;
            reg = /<body.*data-view-url=[\"'](.*)[\"'].*/im.exec(response);
            if (reg && reg.length > 1) {
                // view url as data attribute on body (Plone 5)
                return reg[1].split('"')[0];
            }
            reg = /<body.*data-base-url=[\"'](.*)[\"'].*/im.exec(response);
            if (reg && reg.length > 1) {
                // Base url as data attribute on body (Plone 5)
                return reg[1].split('"')[0];
            }
            reg = /<base.*href=[\"'](.*)[\"'].*/im.exec(response);
            if (reg && reg.length > 1) {
                // base tag available (Plone 4)
                return reg[1];
            }
            return '';
        },

        endsWith: function(string, suffix) {
            string = string.toLowerCase();
            return string.indexOf(suffix, string.length - suffix.length) !== -1;
        },

        makeAjaxUrl: function(url) {
            var query = '';
            $.each(this.options.ajaxExtraParameter || {}, function(key, val) {
                query += key + '=' + val;
            });
            if (url.indexOf('?') === -1) {
                url += '?' + query;
            } else {
                url += '&' + query;
            }
            return url;
        }

    });

    return Modal;
});
