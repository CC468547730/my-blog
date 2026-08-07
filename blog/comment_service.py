"""评论业务逻辑层（Thin Views, Thick Services 原则）。

集中处理评论的创建、审核状态流转。视图层只做 HTTP 编排，不直接写 ORM 逻辑。
"""
from django.utils import timezone

from blog.models import (
    Comment,
    COMMENT_STATUS_APPROVED,
    COMMENT_STATUS_PENDING,
    COMMENT_STATUS_REJECTED,
)


def create_comment(article, author_name, content, ip_address=None, author_email=''):
    """创建一条新评论（默认「待审核」状态）。

    Args:
        article: 关联的文章对象（blog.Article）
        author_name: 昵称（登录用户由视图层自动传入 request.user.username）
        content: 评论正文（纯文本）
        ip_address: 提交者 IP，用于 60s 内同 IP + 相同内容去重
        author_email: 邮箱（可选）

    Returns:
        Comment: 已保存的评论对象

    Raises:
        ValueError: 当 60s 内同 IP + 相同内容已存在待审核评论（去重）
    """
    # 去重：同 IP + 相同内容 + 60s 内已有待审核评论则拒绝重复提交
    if ip_address:
        recent = Comment.objects.filter(
            article=article,
            ip_address=ip_address,
            content=content,
            status=COMMENT_STATUS_PENDING,
            created_at__gte=timezone.now() - timezone.timedelta(seconds=60),
        ).exists()
        if recent:
            raise ValueError('评论提交过于频繁，请稍后再试')

    comment = Comment.objects.create(
        article=article,
        author_name=author_name,
        author_email=author_email or '',
        content=content,
        ip_address=ip_address,
        status=COMMENT_STATUS_PENDING,  # 默认不公开（FR-002）
    )
    return comment


def approve_comment(comment):
    """审核通过：置为已通过状态（前台可见）。"""
    comment.status = COMMENT_STATUS_APPROVED
    comment.save(update_fields=['status'])
    return comment


def reject_comment(comment):
    """审核驳回：置为已驳回状态（前台不可见）。"""
    comment.status = COMMENT_STATUS_REJECTED
    comment.save(update_fields=['status'])
    return comment


def delete_comment(comment):
    """物理删除评论（级联影响外键引用自动处理）。"""
    comment.delete()
