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
    'mockup-utils',
    'domurl',
    'text!mockup-patterns-modal/template.xml',
    'translate',
    'jquery.form',
    'modernizr'
], function($, _, Base, registry, utils, modalTemplate, _t) {

    'use strict';

    var Modal = Base.extend({
        name: 'plone-modal',
        trigger: '.pat-plone-modal',
        parser: 'mockup',

        createModal: null,
        loading: null,

        defaults: {
            actionButtonSelector: '.formControls > input[type="submit"]',
            content: '#content',
            prependContent: '.portalMessage',
            actions: {},
            actionOptions: {
                target: null,
                ajaxUrl: null, // string, or function($el, options) that returns a string
                timeout: 5000,
                displayInModal: false,
                reloadWindowOnClose: true,
                error: '.portalMessage.error',
                formFieldError: '.field.error',
                redirectOnResponse: false,
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
                }
            },
        },

        // transition setup
        transEndEventName: {
            'WebkitTransition': 'webkitTransitionEnd',
            'MozTransition': 'transitionend',
            'OTransition': 'oTransitionEnd',
            'msTransition': 'MSTransitionEnd',
            'transition': 'transitionend'
        }[Modernizr.prefixed('transition')],
        browserSupport: {transitions: Modernizr.csstransitions},

        reloadWindow: function() {
            window.parent.location.reload();
        },
        init: function() {
            if (this.$el.attr('href') && !this.options.image) {
                if (!this.options.target && this.$el.attr('href').substr(0, 1) === '#') {
                    this.options.target = this.$el.attr('href');
                    this.options.content = '';
                }
                if (!this.options.ajaxUrl && this.$el.attr('href').substr(0, 1) !== '#') {
                    this.options.ajaxUrl = this.$el.attr('href');
                }
            }
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
                url: this.options.ajaxUrl,
                type: this.options.ajaxType
            }).done(function(response, textStatus, xhr) {
                this.ajaxXHR = undefined;
                this.$raw = $('<div />').append($(utils.parseBodyTag(response)));
                this.emit('after-ajax', this, textStatus, xhr);
                this.show();
            }.bind(this)).fail(function(xhr, textStatus, errorStatus) {
                var options = this.options.actionOptions;
                window.alert(_t('There was an error loading modal.'));
                this.hide();
                this.emit('linkActionError', [xhr, textStatus, errorStatus]);
            }.bind(this)).always(function() {
                this.loading.hide();
            }.bind(this));
        },

        createTargetModal: function() {
            this.$raw = $(this.options.target).clone();
            this.show();
        },

        createBasicModal: function() {
            this.$raw = $('<div/>').html(this.$el.clone());
            this.show();
        },

        createHtmlModal: function() {
            var $el = $(this.options.html);
            this.$raw = $el;
            this.show();
        },

        createImageModal: function() {
            var src = this.$el.attr('href');
            this.$raw = $('<div><h1>Image</h1><div id="content"><div class="modal-image"><img src="' + src + '" /></div></div></div>');
            this.show();
        },

        initModal: function() {
            if (this.options.ajaxUrl) {
                this.createModal = this.createAjaxModal;
            } else if (this.options.target) {
                this.createModal = this.createTargetModal;
            } else if (this.options.html) {
                this.createModal = this.createHtmlModal;
            } else if (this.options.image){
                this.createModal = this.createImageModal;
            } else {
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
                prepend: '',
                content: '',
                buttons: '<div class="fancyoverlay-buttons"></div>'
            };

            // Grab items to to insert into the prepend area
            if (this.options.prependContent) {
                templateOptions.prepend = $('<div />').append($(this.options.prependContent, $raw).clone()).html();
                $(this.options.prependContent, $raw).remove();
            }

            // Filter out the content if there is a selector provided
            if (this.options.content) {
                templateOptions.content = $(this.options.content, $raw).html();
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
            $(this.options.actionButtonSelector, this.$modal).each(function() {
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

            // CLOSE modal
            $('.fancyoverlay-close', this.$modal)
              .off('click')
              .on('click', function(e) {
                e.stopPropagation();
                e.preventDefault();
                $(e.target).trigger('destroy.plone-modal.patterns');
            });

            // INIT FORM
            this.form();

            this.$modal.on('destroy.plone-modal.patterns', function(e) {
                e.stopPropagation();
                this.hide();
            }.bind(this));

            this.$modal.appendTo($('body'));

            this.emit('after-render');
        },

        show: function() {
            this.render();
            this.emit('show');
            this.loading.hide();
            this.$el.addClass('open');
            this.$modal.addClass('open');
            registry.scan(this.$modal);
            $('body').addClass('plone-modal-open');
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
                if (this.browserSupport.transitions) {
                    if (ev.propertyName !== 'visibility') {
                        return;
                    }
                    this.removeEventListener(this.transEndEventName, onEndTransitionFn);
                }
                if (this.$modal !== undefined) {
                    this.$modal.removeClass('close');
                    this.$modal.remove();
                }
            }.bind(this);

            this.$modal.removeClass('open');
            this.$modal.addClass('close');
            if (this.browserSupport.transitions) {
                this.$modal.addEventListener(this.transEndEventName, onEndTransitionFn);
            } else {
                onEndTransitionFn();
            }

            this.$el.removeClass('open');
            if ($('.plone-modal', $('body')).size() < 1) {
                $('body').removeClass('plone-modal-open');
            }

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

            $(this.options.actionButtonSelector, this.$modal).each(function() {
                var $action = $(this);
                $action.on('click', function(e) {
                    e.stopPropagation();
                    e.preventDefault();

                    that.loading.show(false);

                    if (this.tagName.toLowerCase() === 'input' || this.tagName.toLowerCase() === 'button') {
                        that.handleFormAction($action);
                    // handle event on link with jQuery.ajax
                    } else if (that.options.actionOptions.ajaxUrl !== null || this.tagName.toLowerCase() === 'a') {
                        that.handleLinkAction($action);
                    }

                });
            });
        },

        handleFormAction: function($action) {
            // pass action that was clicked when submiting form
            var extraData = {};
            extraData[$action.attr('name')] = $action.attr('value');

            var $form;

            if ($.nodeName($action[0], 'form')) {
                $form = $action;
            } else {
                $form = $action.parents('form:not(.disableAutoSubmit)');
            }

            var url = this.options.actionOptions.ajaxUrl || $action.parents('form').attr('action');

            // We want to trigger the form submit event but NOT use the default
            $form.on('submit', function(e) {
                e.preventDefault();
            });
            $form.trigger('submit');

            this.loading.show(false);
            $form.ajaxSubmit({
                timeout: this.options.actionOptions.timeout,
                data: extraData,
                url: url,
                error: function(xhr, textStatus, errorStatus) {
                    this.loading.hide();
                    window.alert(_t('There was an error submitting the form.'));
                    console.log('error happened do something');
                    this.emit('formActionError', [xhr, textStatus, errorStatus]);
                }.bind(this),
                success: function(response, state, xhr, form) {
                    this.loading.hide();
                    // if error is found (NOTE: check for both the portal errors
                    // and the form field-level errors)
                    if ($(this.options.actionOptions.error, response).size() !== 0 ||
                        $(this.options.actionOptions.formFieldError, response).size() !== 0) {
                        this.redraw(response);
                        return;
                    }

                    if (this.options.actionOptions.redirectOnResponse === true) {
                        if (typeof this.options.actionOptions.redirectToUrl === 'function') {
                            window.parent.location.href = this.options.actionOptions.redirectToUrl(response);
                        } else {
                            window.parent.location.href = this.options.actionOptions.redirectToUrl;
                        }
                        return; // cut out right here since we're changing url
                    }

                    if (this.options.actionOptions.displayInModal === true) {
                        this.redraw(response);
                    } else {
                        $action.trigger('destroy.plone-modal.patterns');
                        // also calls hide
                        if (this.options.actionOptions.reloadWindowOnClose) {
                            this.reloadWindow();
                        }
                    }
                    this.emit('formActionSuccess', [response, state, xhr, form]);
                }.bind(this)
            });
        },

        handleLinkAction: function($action) {
            var url = this.options.actionOptions.ajaxUrl || $action.attr('href');

            // Non-ajax link (I know it says "ajaxUrl" ...)
            if (this.options.actionOptions.displayInModal === false) {
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
                url: url
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

    });

    return Modal;
});
