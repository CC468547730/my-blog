from django.contrib.auth.models import User
from django.db import models
from django.utils import timezone
from django.utils.text import slugify


class Category(models.Model):
    """文章分类"""

    name = models.CharField(max_length=100, unique=True, verbose_name='分类名称')
    slug = models.SlugField(max_length=120, unique=True, blank=True, verbose_name='别名')
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')

    class Meta:
        verbose_name = '分类'
        verbose_name_plural = '分类'
        ordering = ['-created_at']

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True)
        super().save(*args, **kwargs)


class Tag(models.Model):
    """文章标签"""

    name = models.CharField(max_length=100, unique=True, verbose_name='标签名称')
    slug = models.SlugField(max_length=120, unique=True, blank=True, verbose_name='别名')

    class Meta:
        verbose_name = '标签'
        verbose_name_plural = '标签'

    def __str__(self):
        return self.name

    def save(self, *args, **kwargs):
        if not self.slug:
            self.slug = slugify(self.name, allow_unicode=True)
        super().save(*args, **kwargs)


class Article(models.Model):
    """博客文章（支持 Markdown 正文）"""

    title = models.CharField(max_length=200, verbose_name='标题')
    content = models.TextField(verbose_name='正文')
    author = models.ForeignKey(
        User, on_delete=models.CASCADE, related_name='articles', verbose_name='作者'
    )
    category = models.ForeignKey(
        Category, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='articles', verbose_name='分类'
    )
    tags = models.ManyToManyField(
        Tag, blank=True, related_name='articles', verbose_name='标签'
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='创建时间')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='更新时间')

    class Meta:
        ordering = ['-created_at']
        verbose_name = '文章'
        verbose_name_plural = '文章'

    def __str__(self):
        return self.title

    def get_absolute_url(self):
        from django.urls import reverse
        return reverse('blog:article_detail', args=[self.pk])


# ===================== 评论模型（Article Comments） =====================

# 评论审核状态常量：待审核 / 已通过 / 已驳回
COMMENT_STATUS_PENDING = 'pending'
COMMENT_STATUS_APPROVED = 'approved'
COMMENT_STATUS_REJECTED = 'rejected'
COMMENT_STATUS_CHOICES = [
    (COMMENT_STATUS_PENDING, '待审核'),
    (COMMENT_STATUS_APPROVED, '已通过'),
    (COMMENT_STATUS_REJECTED, '已驳回'),
]


class Comment(models.Model):
    """文章评论模型。

    设计要点（依据 spec.md / data-model.md / constitution v1.0.0）：
    - article: 外键关联文章，删除文章时级联删除评论（CASCADE）
    - author_name: 昵称（必填）；登录用户提交时自动带出其用户名
    - author_email: 邮箱（可选，不对外公开展示）
    - content: 评论正文（纯文本，前台用 Django 自动转义渲染，杜绝 XSS）
    - status: 审核状态，新评论默认「待审核」，不立即公开（FR-002）
    - ip_address: 用于 60s 内同 IP + 相同内容去重，防止重复提交刷屏
    - created_at: 创建时间（索引，用于前台按时间升序展示）
    """

    article = models.ForeignKey(
        Article,
        on_delete=models.CASCADE,
        related_name='comments',
        verbose_name='所属文章',
        db_index=True,
    )
    author_name = models.CharField(max_length=50, verbose_name='昵称')
    author_email = models.EmailField(blank=True, verbose_name='邮箱（可选）')
    content = models.TextField(max_length=1000, verbose_name='评论内容')
    status = models.CharField(
        max_length=10,
        choices=COMMENT_STATUS_CHOICES,
        default=COMMENT_STATUS_PENDING,
        verbose_name='审核状态',
        db_index=True,
    )
    ip_address = models.GenericIPAddressField(
        null=True, blank=True, verbose_name='提交者 IP'
    )
    created_at = models.DateTimeField(
        auto_now_add=True, verbose_name='创建时间', db_index=True
    )

    class Meta:
        verbose_name = '评论'
        verbose_name_plural = '评论'
        ordering = ['created_at']  # 前台默认按时间升序展示
        db_table = 'blog_comments'
        indexes = [
            models.Index(
                fields=['article', 'status'], name='idx_comment_art_status'
            ),
        ]

    def __str__(self):
        return f'{self.author_name} 对《{self.article.title}》的评论'

    @property
    def is_approved(self):
        """是否通过审核（前台仅展示已通过评论）。"""
        return self.status == COMMENT_STATUS_APPROVED
