from django import template

register = template.Library()


@register.filter(name='add_class')
def add_class(value, css_class):
    """为表单字段的 widget 添加 CSS 类"""
    if hasattr(value, 'as_widget'):
        attrs = value.field.widget.attrs.get('class', '')
        classes = f"{attrs} {css_class}".strip()
        return value.as_widget(attrs={'class': classes})
    return value
