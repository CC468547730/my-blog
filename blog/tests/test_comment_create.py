"""评论功能单元测试（US1：访客发表评论）。

覆盖 spec FR-001/002/006 与 constitution 原则 III（核心流程测试）。
"""
from django.test import TestCase
from django.urls import reverse

from blog.comment_service import create_comment
from blog.models import Article, Comment, User


class CommentCreateTest(TestCase):
    """US1：访客/登录用户可提交评论，默认待审核（FR-001/002）。"""

    def setUp(self):
        self.user = User.objects.create_user(
            username='author1', password='testpass123'
        )
        self.article = Article.objects.create(
            title='测试文章', content='正文内容', author=self.user
        )
        self.url = reverse('blog:comment_create', args=[self.article.pk])

    def test_anonymous_comment_defaults_pending(self):
        """访客提交评论 → status=pending 且未公开（T008 / FR-002）。"""
        resp = self.client.post(
            self.url,
            {'author_name': '路人甲', 'content': '这是一条评论'},
        )
        self.assertEqual(resp.status_code, 302)  # 重定向回文章页
        comment = Comment.objects.latest('id')
        self.assertEqual(comment.status, 'pending')
        self.assertFalse(comment.is_approved)

    def test_logged_in_user_auto_name(self):
        """登录用户提交 → author_name 自动取用户名（T009 / 解决 A1）。"""
        self.client.force_login(self.user)
        resp = self.client.post(
            self.url, {'content': '登录用户的评论'}
        )
        self.assertEqual(resp.status_code, 302)
        comment = Comment.objects.latest('id')
        # 视图层从 request.user.username 自动填充昵称
        self.assertEqual(comment.author_name, 'author1')

    def test_empty_required_field_rejected(self):
        """必填项为空 → 校验失败不入库（T010 / FR-006）。"""
        before = Comment.objects.count()
        # 故意留空 content，触发表单校验失败
        resp = self.client.post(self.url, {'author_name': '路人', 'content': ''})
        self.assertEqual(resp.status_code, 302)  # 重定向回文章页
        self.assertEqual(Comment.objects.count(), before)  # 未写入数据库

    def test_create_comment_service_pending(self):
        """service 层创建默认 pending（单元级验证）。"""
        c = create_comment(
            article=self.article,
            author_name='单元',
            content='service 测试',
            ip_address='127.0.0.1',
        )
        self.assertEqual(c.status, 'pending')
