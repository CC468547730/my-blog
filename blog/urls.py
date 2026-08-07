from django.urls import path

from . import views

app_name = 'blog'

urlpatterns = [
    # 首页：文章列表（分页每页 5 篇）
    path('', views.ArticleListView.as_view(), name='article_list'),
    # 助理：品牌专属通道（暂未开放）
    path('assistant/', views.assistant_view, name='assistant'),
    # 发布文章（需登录）
    path('article/new/', views.ArticleCreateView.as_view(), name='article_create'),
    # 文章详情
    path('article/<int:pk>/', views.ArticleDetailView.as_view(), name='article_detail'),
    # 编辑文章（仅作者）
    path('article/<int:pk>/edit/', views.ArticleUpdateView.as_view(), name='article_update'),
    # 删除文章（仅作者）
    path('article/<int:pk>/delete/', views.ArticleDeleteView.as_view(), name='article_delete'),
    # 分类筛选：支持 id 或 slug（中文 slug）
    path('category/<int:pk>/', views.CategoryView.as_view(), name='category_detail'),
    path('category/<str:slug>/', views.CategoryView.as_view(), name='category_detail_slug'),
    # 标签筛选：支持 id 或 slug（中文 slug）
    path('tag/<int:pk>/', views.TagView.as_view(), name='tag_detail'),
    path('tag/<str:slug>/', views.TagView.as_view(), name='tag_detail_slug'),

    # ---------- 自定义后台（Dashboard）----------
    # 仪表盘首页
    path('dashboard/', views.dashboard_home, name='dashboard_home'),
    # 文章管理
    path('dashboard/articles/', views.dashboard_article_list, name='dashboard_article_list'),
    path('dashboard/articles/new/', views.dashboard_article_create, name='dashboard_article_create'),
    path('dashboard/articles/<int:pk>/edit/', views.dashboard_article_edit, name='dashboard_article_edit'),
    path('dashboard/articles/<int:pk>/delete/', views.dashboard_article_delete, name='dashboard_article_delete'),
    # 分类管理
    path('dashboard/categories/', views.dashboard_category_list, name='dashboard_category_list'),
    path('dashboard/categories/<int:pk>/edit/', views.dashboard_category_edit, name='dashboard_category_edit'),
    path('dashboard/categories/<int:pk>/delete/', views.dashboard_category_delete, name='dashboard_category_delete'),
    # 标签管理
    path('dashboard/tags/', views.dashboard_tag_list, name='dashboard_tag_list'),
    path('dashboard/tags/<int:pk>/edit/', views.dashboard_tag_edit, name='dashboard_tag_edit'),
    path('dashboard/tags/<int:pk>/delete/', views.dashboard_tag_delete, name='dashboard_tag_delete'),
    # 用户管理（仅超级管理员）
    path('dashboard/users/', views.dashboard_user_list, name='dashboard_user_list'),
    path('dashboard/users/<int:pk>/edit/', views.dashboard_user_edit, name='dashboard_user_edit'),
    path('dashboard/users/<int:pk>/reset/', views.dashboard_user_reset, name='dashboard_user_reset'),
    path('dashboard/users/<int:pk>/delete/', views.dashboard_user_delete, name='dashboard_user_delete'),
    # 评论功能（US1）：前台文章页提交评论（仅 POST，CSRF 保护）
    path('article/<int:pk>/comment/', views.comment_create, name='comment_create'),

    # 评论审核管理（US2：后台审核，仅超级管理员）
    path('dashboard/comments/', views.dashboard_comment_list, name='dashboard_comment_list'),
    path('dashboard/comments/moderate/', views.dashboard_comment_moderate, name='dashboard_comment_moderate'),
    path('dashboard/comments/bulk-moderate/', views.dashboard_comment_bulk_moderate, name='dashboard_comment_bulk_moderate'),
]

