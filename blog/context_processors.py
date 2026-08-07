"""
博客应用上下文处理器

作用：向所有模板注入全局可用的上下文变量，避免在每个视图中重复传递。
当前提供「待审核评论数量」，用于后台侧边栏「评论审核」菜单项的 badge 提示。
"""
from django.db.models import Count

from blog.models import Comment, COMMENT_STATUS_PENDING


def pending_comment_count(request):
    """向模板注入待审核评论数量

    仅在登录用户为超级管理员时查询数据库并返回真实计数值；
    其他情况返回 0（非超管不显示评论审核菜单，无需计数，避免无谓查询）。
    """
    # 非超管直接返回 0，避免前台匿名/普通用户也触发数据库查询
    if not getattr(request, 'user', None) or not request.user.is_authenticated or not request.user.is_superuser:
        return {'pending_comment_count': 0}

    try:
        count = Comment.objects.filter(status=COMMENT_STATUS_PENDING).count()
    except Exception:
        # 异常时降级为 0，保证页面正常渲染
        count = 0

    return {'pending_comment_count': count}
