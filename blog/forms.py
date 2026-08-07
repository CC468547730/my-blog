"""博客表单定义：评论提交表单。

说明：My-Blog 为单体 Django 项目，表单集中放此模块（符合项目既有风格）。
"""
from django import forms

from blog.models import Comment


class CommentForm(forms.ModelForm):
    """前台评论提交表单（FR-006 服务端校验）。"""

    class Meta:
        model = Comment
        # 仅暴露用户可填字段；article/status/ip_address 由视图层处理
        fields = ['author_name', 'author_email', 'content']
        widgets = {
            'author_name': forms.TextInput(
                attrs={'class': 'form-control', 'placeholder': '您的昵称'}
            ),
            'author_email': forms.EmailInput(
                attrs={'class': 'form-control', 'placeholder': '邮箱（可选）'}
            ),
            'content': forms.Textarea(
                attrs={
                    'class': 'form-control',
                    'rows': 4,
                    'placeholder': '写下您的评论……',
                    'maxlength': 1000,
                }
            ),
        }
        labels = {
            'author_name': '昵称',
            'author_email': '邮箱',
            'content': '评论内容',
        }

    def clean_author_name(self):
        """昵称非空且长度合规（FR-006）。"""
        name = (self.cleaned_data.get('author_name') or '').strip()
        if not name:
            raise forms.ValidationError('昵称不能为空')
        if len(name) > 50:
            raise forms.ValidationError('昵称不能超过 50 个字符')
        return name

    def clean_content(self):
        """评论内容非空且长度合规（FR-006）。"""
        content = (self.cleaned_data.get('content') or '').strip()
        if not content:
            raise forms.ValidationError('评论内容不能为空')
        if len(content) > 1000:
            raise forms.ValidationError('评论内容不能超过 1000 个字符')
        return content
