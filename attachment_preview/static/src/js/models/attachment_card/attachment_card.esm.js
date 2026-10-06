/** @odoo-module **/
if (!odoo.__attachment_card_defined__) {
    odoo.__attachment_card_defined__ = true;
    odoo.define("attachment_preview.attachment_card", function (require) {
        var rpc = require("web.rpc");
        var FormRenderer = require("web.FormRenderer");
        var AttachmentPreviewWidget = require("attachment_preview.attachmentPreviewWidget");
        var { registerInstancePatchModel } = require("@mail/model/model_core");
        

        var chatterpreviewableAttachments = [];
        var active_attachment_id = 0;
        var first_click = true;

        FormRenderer.include({
            custom_events: _.extend({}, FormRenderer.prototype.custom_events, {
                onAttachmentPreview: "_onAttachmentPreview",
            }),
            attachmentPreviewWidget: null,

            init: function () {
                var res = this._super(...arguments);
                this.attachmentPreviewWidget = new AttachmentPreviewWidget(this);
                this.attachmentPreviewWidget.on(
                    "hidden",
                    this,
                    this._attachmentPreviewWidgetHidden
                );
                return res;
            },

            start: function () {
                var self = this;
                return this._super.apply(this, arguments).then(function () {
                    self.attachmentPreviewWidget.insertAfter(self.$el);
                });
            },

            _attachmentPreviewWidgetHidden: function () {
                this.$el.removeClass("attachment_preview");
            },

            showAttachmentPreviewWidget: function (first_c) {
                this.$el.addClass("attachment_preview");

                this.attachmentPreviewWidget.setAttachments(
                    chatterpreviewableAttachments,
                    active_attachment_id,
                    first_c
                );
                this.attachmentPreviewWidget.show();
            },

            on_detach_callback: function () {
                this.attachmentPreviewWidget.hide();
                return this._super.apply(this, arguments);
            },

            _onAttachmentPreview: function () {
                first_click = true;
                this.showAttachmentPreviewWidget(first_click);
            },
        });

        function canPreview(extension) {
            return ["odt", "odp", "ods", "fodt", "pdf", "ott", "fodp", "otp", "fods", "ots"].includes(extension);
        }

        function getUrl(attachment_id, attachment_url, attachment_extension, attachment_title) {
            var url = "";
            if (attachment_url) {
                if (attachment_url.startsWith("/web/static/lib/pdfjs")) {
                    url = (window.location.origin || "") + attachment_url;
                } else {
                    url = `${window.location.origin || ""}/attachment_preview/static/lib/ViewerJS/index.html?type=${encodeURIComponent(attachment_extension)}&title=${encodeURIComponent(attachment_title)}&zoom=automatic#${attachment_url.replace(window.location.origin, "")}`;
                }
                return url;
            }
            return `${window.location.origin || ""}/attachment_preview/static/lib/ViewerJS/index.html?type=${encodeURIComponent(attachment_extension)}&title=${encodeURIComponent(attachment_title)}&zoom=automatic#/web/content/${attachment_id}?model%3Dir.attachment`;
        }

        registerInstancePatchModel(
            "mail.attachment_card",
            "attachment_preview/static/src/js/models/attachment_card/attachment_card.js",
            {
                _created() {
                    this._super();
                    this._onPreviewAttachment = this._onPreviewAttachment.bind(this);

                    var attachments = Object.fromEntries(
                        this.attachmentList.attachments.map(attachment => [
                            attachment.id,
                            {
                                url: attachment.defaultSource?.length > 38 ? attachment.defaultSource : `/web/content?id=${attachment.id}&download=true`,
                                extension: attachment.extension,
                                title: attachment.name,
                            },
                        ])
                    );

                    rpc.query({
                        model: "ir.attachment",
                        method: "get_attachment_extension",
                        args: [Object.keys(attachments).map(id => parseInt(id, 10))],
                    }).then(extensions => {
                        var reviewableAttachments = Object.keys(extensions)
                            .filter(id => canPreview(extensions[id]))
                            .map(id => ({
                                id,
                                url: attachments[id].url,
                                extension: extensions[id],
                                title: attachments[id].title,
                                previewUrl: getUrl(id, attachments[id].url, extensions[id], attachments[id].title),
                            }));

                        chatterpreviewableAttachments = reviewableAttachments;
                    });
                },

                _showPreview(attachment_id, attachment_url, attachment_extension, attachment_title, split_screen) {
                    var url = getUrl(attachment_id, attachment_url, attachment_extension, attachment_title);

                    if (split_screen) {
                        this.component.trigger("onAttachmentPreview", {
                            url: url,
                            active_attachment_id: active_attachment_id,
                        });
                    } else {
                        window.open(url);
                    }
                },

                _onPreviewAttachment(event) {
                    event.preventDefault();

                    var self = this;
                    var $target = $(event.currentTarget);
                    var split_screen = $target.attr("data-target") !== "new";
                    var attachment_id = this.attachment.id;
                    var attachment_title = this.attachment.filename;
                    var attachment_url = this.attachment.defaultSource;
                    active_attachment_id = attachment_id;

                    rpc.query({
                        model: "ir.attachment",
                        method: "get_attachment_extension",
                        args: [attachment_id],
                    }).then(function (extension) {
                        self._showPreview(attachment_id, attachment_url, extension, attachment_title, split_screen);
                    });
                },
            }
        );
    });
}
