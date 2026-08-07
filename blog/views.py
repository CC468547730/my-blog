import markdown
import re
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib.auth.mixins import LoginRequiredMixin
from django.contrib.auth.models import User
from django.contrib import messages
from django.db.models import Count
from django import forms
from django.forms import ModelForm
from django.shortcuts import get_object_or_404, redirect, render
from django.template import loader
from django.core.paginator import Paginator
from django.views.decorators.http import require_POST


def assistant_view(request):
    """助理入口：办公室工具箱聚合页（纯前端、无需登录）

    继承 blog/base.html，复用站点统一导航栏与页脚；
    show_sidebar=False 关闭右侧边栏，使工具区独占整行宽度。
    """
    return render(request, 'blog/assistant.html', {'show_sidebar': False})
from django.urls import reverse_lazy
from django.views.generic import (
    CreateView,
    DeleteView,
    DetailView,
    ListView,
    UpdateView,
)

from .models import (
    Article,
    Category,
    Tag,
    Comment,
    COMMENT_STATUS_PENDING,
    COMMENT_STATUS_APPROVED,
    COMMENT_STATUS_REJECTED,
    COMMENT_STATUS_CHOICES,
)

# 仅允许站点员工（is_staff）访问自定义后台
# 未登录 -> 跳登录页；已登录但非 staff -> 返回 403，避免与登录页形成重定向死循环
def staff_required(view_func):
    from django.core.exceptions import PermissionDenied

    @user_passes_test(
        lambda u: u.is_authenticated,
        login_url=reverse_lazy('users:login'),
    )
    def _check_login(request, *args, **kwargs):
        if not request.user.is_staff:
            raise PermissionDenied('需要管理员权限才能访问后台')
        return view_func(request, *args, **kwargs)

    return _check_login


# 仅超级管理员可管理（文章列表/编辑/删除、分类、标签、仪表盘）
# 普通 staff 仅能在发布文章页发文，不允许管理操作
def admin_required(view_func):
    from django.core.exceptions import PermissionDenied

    @user_passes_test(
        lambda u: u.is_authenticated,
        login_url=reverse_lazy('users:login'),
    )
    def _check_admin(request, *args, **kwargs):
        if not request.user.is_superuser:
            raise PermissionDenied('仅管理员可访问该页面')
        return view_func(request, *args, **kwargs)

    return _check_admin


# 自定义 403 页面：门扉紧闭，光影未至
def handler403(request, exception=None):
    from django.http import HttpResponseForbidden
    template = loader.get_template('403.html')
    return HttpResponseForbidden(template.render({}, request))


# 复用的 Markdown 渲染配置
MARKDOWN_EXTENSIONS = [
    'markdown.extensions.extra',
    'markdown.extensions.codehilite',
    'markdown.extensions.toc',
]


def render_markdown(text):
    """将 Markdown 文本渲染为 HTML 字符串

    额外支持 mermaid 流程图：```mermaid 代码块在渲染前先抽离，
    避免被 codehilite 高亮破坏语法，渲染后还原为 <pre class="mermaid">，
    交由前端 mermaid.js 渲染。
    """
    # 1. 先抽取 mermaid 代码块，用 HTML 注释占位符替换（markdown 不会解析注释）
    mermaid_blocks = []

    def _extract(match):
        mermaid_blocks.append(match.group(1))
        return '\n\n<!-- MERMAID_PLACEHOLDER_%d -->\n\n' % (len(mermaid_blocks) - 1)

    fence_pattern = re.compile(
        r'```mermaid\s*\n(.*?)```', re.DOTALL | re.IGNORECASE
    )
    text = fence_pattern.sub(_extract, text)

    # 2. 正常渲染（codehilite 不会碰到注释占位符）
    html = markdown.markdown(text, extensions=MARKDOWN_EXTENSIONS)

    # 3. 还原占位符为标准 mermaid 块
    def _restore(match):
        idx = int(match.group(1))
        return '<pre class="mermaid">%s</pre>' % mermaid_blocks[idx]

    html = re.sub(
        r'<!--\s*MERMAID_PLACEHOLDER_(\d+)\s*-->',
        _restore,
        html,
    )
    return html


def sync_tags_to_article(article, tags_text):
    """将逗号分隔的标签文本解析并关联到文章。

    按 slug（大小写归一）匹配已有标签，避免同名不同大小写导致的 slug 冲突。
    """
    from django.utils.text import slugify
    names = [n.strip() for n in tags_text.replace('，', ',').split(',') if n.strip()]
    tags = []
    for name in names:
        slug = slugify(name, allow_unicode=True)
        tag, _ = Tag.objects.get_or_create(
            slug=slug,
            defaults={'name': name},
        )
        # 若已存在同名不同展示名的标签，同步更新显示名
        if tag.name != name:
            tag.name = name
            tag.save(update_fields=['name'])
        tags.append(tag)
    article.tags.set(tags)


class SidebarMixin:
    """为前台列表页提供侧边栏数据（分类、标签、最新文章、热门文章、作者、日历）"""

    def get(self, request, *args, **kwargs):
        # 仅列表视图带 paginate_by，详情等非分页视图直接走默认流程
        if not getattr(self, 'paginate_by', None):
            return super().get(request, *args, **kwargs)
        # 提前分页，捕获越界页码 -> 渲染友好提示页而非 404
        self.object_list = self.get_queryset()
        paginator = Paginator(self.object_list, self.paginate_by)
        page_param = request.GET.get(self.page_kwarg)
        if page_param:
            try:
                page_number = int(page_param)
            except (TypeError, ValueError):
                page_number = 1
            if paginator.num_pages and page_number > paginator.num_pages:
                return render(
                    request,
                    'blog/article_empty_page.html',
                    {
                        'total_pages': paginator.num_pages,
                        'requested_page': page_param,
                    },
                )
        return super().get(request, *args, **kwargs)

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['sidebar_categories'] = Category.objects.annotate(
            num_articles=Count('articles')
        ).order_by('-num_articles')[:10]
        context['sidebar_tags'] = Tag.objects.annotate(
            num_articles=Count('articles')
        ).order_by('-num_articles')[:20]
        context['sidebar_recent'] = Article.objects.all()[:5]
        # 热门文章：按文章数排序（无阅读量字段，暂以最新中的前数篇模拟）
        context['sidebar_popular'] = Article.objects.all()[:5]
        # 作者介绍：取文章最多的作者
        author = User.objects.annotate(
            num_articles=Count('articles')
        ).order_by('-num_articles').first()
        context['sidebar_author'] = author
        context['sidebar_author_count'] = author.articles.count() if author else 0
        # 日历数据：当前月份，生成二维网格供模板渲染
        import calendar as _calendar
        from datetime import date
        today = date.today()
        context['cal_year'] = today.year
        context['cal_month'] = today.month
        context['cal_month_name'] = '%d年%d月' % (today.year, today.month)
        context['cal_today'] = today.day
        # 当月第一天星期(0=Mon)、总天数
        first_weekday, days_in_month = _calendar.monthrange(today.year, today.month)
        # 转为以周一为起始的偏移
        lead = (first_weekday) % 7
        cells = [''] * lead + [d for d in range(1, days_in_month + 1)]
        while len(cells) % 7 != 0:
            cells.append('')
        context['cal_weeks'] = [cells[i:i+7] for i in range(0, len(cells), 7)]
        return context


class ArticleListView(SidebarMixin, ListView):
    """首页：所有文章列表，分页每页 5 篇"""

    model = Article
    template_name = 'blog/article_list.html'
    context_object_name = 'articles'
    paginate_by = 5

    def get_queryset(self):
        # 为每篇文章预渲染 Markdown 摘要（前 200 字符）
        queryset = Article.objects.all()
        q = self.request.GET.get('q')
        if q:
            from django.db.models import Q
            queryset = queryset.filter(
                Q(title__icontains=q) | Q(content__icontains=q)
            )
        for article in queryset:
            snippet = article.content[:200]
            article.summary_html = render_markdown(snippet)
        return queryset


class ArticleDetailView(SidebarMixin, DetailView):
    """文章详情：完整文章，content 渲染为 HTML"""

    model = Article
    template_name = 'blog/article_detail.html'
    context_object_name = 'article'

    def get_object(self, queryset=None):
        article = super().get_object(queryset)
        # content 字段通过 markdown 渲染为 HTML 后挂到对象上
        article.content_html = render_markdown(article.content)
        return article

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        # 供模板判断：当前登录用户是否为文章作者
        article = self.object
        context['is_author'] = (
            self.request.user.is_authenticated
            and article.author_id == self.request.user.pk
        )
        # 已通过评论列表（US3：前台仅展示 approved，按时间升序；内容模板默认转义）
        context['approved_comments'] = article.comments.filter(
            status=COMMENT_STATUS_APPROVED
        )
        return context


class CategoryView(SidebarMixin, ListView):
    """按分类过滤文章（支持 slug 或 id）"""

    template_name = 'blog/article_list.html'
    context_object_name = 'articles'
    paginate_by = 5

    def get_queryset(self):
        category = self._get_category()
        queryset = Article.objects.filter(category=category)
        for article in queryset:
            article.summary_html = render_markdown(article.content[:200])
        return queryset

    def _get_category(self):
        slug = self.kwargs.get('slug')
        if slug:
            return get_object_or_404(Category, slug=slug)
        return get_object_or_404(Category, pk=self.kwargs['pk'])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['category'] = self._get_category()
        return context


class TagView(SidebarMixin, ListView):
    """按标签过滤文章（支持 slug 或 id）"""

    template_name = 'blog/article_list.html'
    context_object_name = 'articles'
    paginate_by = 5

    def get_queryset(self):
        tag = self._get_tag()
        queryset = Article.objects.filter(tags=tag)
        for article in queryset:
            article.summary_html = render_markdown(article.content[:200])
        return queryset

    def _get_tag(self):
        slug = self.kwargs.get('slug')
        if slug:
            return get_object_or_404(Tag, slug=slug)
        return get_object_or_404(Tag, pk=self.kwargs['pk'])

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['tag'] = self._get_tag()
        return context


class ArticleForm(ModelForm):
    """前台发布/编辑文章表单：分类与标签均以文本形式输入"""

    category_text = forms.CharField(
        required=False,
        label='分类',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '输入分类名称，不存在会自动创建',
        }),
        help_text='可直接输入新分类，也会自动同步到前台侧边栏',
    )
    tags_text = forms.CharField(
        required=False,
        label='标签',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '用逗号分隔，如：Python, Django, 教程',
        }),
        help_text='多个标签使用英文逗号或空格分隔，不存在的标签会自动创建',
    )

    class Meta:
        model = Article
        fields = ['title', 'tags_text', 'content']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance and self.instance.pk:
            self.fields['category_text'].initial = (
                self.instance.category.name if self.instance.category else ''
            )
            self.fields['tags_text'].initial = ', '.join(
                t.name for t in self.instance.tags.all()
            )

    def save(self, commit=True):
        tags_text = self.cleaned_data.pop('tags_text', '')
        category_text = self.cleaned_data.pop('category_text', '').strip()
        category = None
        if category_text:
            category, _ = Category.objects.get_or_create(name=category_text)
        self.instance.category = category
        article = super().save(commit=commit)
        if commit:
            sync_tags_to_article(article, tags_text)
        else:
            self._pending_tags_text = tags_text
        return article

    def save_m2m(self):
        super().save_m2m()
        if hasattr(self, '_pending_tags_text'):
            sync_tags_to_article(self.instance, self._pending_tags_text)


class ArticleCreateView(LoginRequiredMixin, CreateView):
    """发布文章（仅登录用户可访问）"""

    model = Article
    template_name = 'blog/article_form.html'
    form_class = ArticleForm

    def form_valid(self, form):
        # 自动将当前登录用户设为作者
        form.instance.author = self.request.user
        return super().form_valid(form)


class ArticleUpdateView(LoginRequiredMixin, UpdateView):
    """编辑文章（仅作者本人可访问）"""

    model = Article
    template_name = 'blog/article_form.html'
    form_class = ArticleForm

    def get_queryset(self):
        # 仅允许作者编辑自己的文章
        return Article.objects.filter(author=self.request.user)


class ArticleDeleteView(LoginRequiredMixin, DeleteView):
    """删除文章（仅作者本人可访问）"""

    model = Article
    template_name = 'blog/article_confirm_delete.html'
    success_url = reverse_lazy('blog:article_list')

    def get_queryset(self):
        # 仅允许作者删除自己的文章
        return Article.objects.filter(author=self.request.user)


# ============================================================================
# 自定义后台（Dashboard）：替代 Django 自带 admin
# ============================================================================

class CategoryForm(ModelForm):
    """分类后台表单"""

    class Meta:
        model = Category
        fields = ['name']


class TagForm(ModelForm):
    """标签后台表单"""

    class Meta:
        model = Tag
        fields = ['name']


class ArticleAdminForm(ModelForm):
    """文章后台表单（管理视角，可指定作者）

    分类与标签均使用文本输入，保存时自动创建并关联。
    """

    category_text = forms.CharField(
        required=False,
        label='分类',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '输入分类名称，不存在会自动创建',
            'list': 'category-datalist',
        }),
        help_text='可直接输入新分类，也会自动同步到前台侧边栏',
    )
    tags_text = forms.CharField(
        required=False,
        label='标签',
        widget=forms.TextInput(attrs={
            'class': 'form-control',
            'placeholder': '用逗号分隔，如：Python, Django, 教程',
        }),
        help_text='多个标签使用英文逗号或空格分隔，不存在的标签会自动创建',
    )

    class Meta:
        model = Article
        fields = ['title', 'author', 'tags_text', 'content']

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # 编辑时预填已有分类与标签
        if self.instance and self.instance.pk:
            self.fields['category_text'].initial = (
                self.instance.category.name if self.instance.category else ''
            )
            self.fields['tags_text'].initial = ', '.join(
                t.name for t in self.instance.tags.all()
            )

    def save(self, commit=True):
        # 先去掉自定义文本字段，避免传给 Article 模型
        tags_text = self.cleaned_data.pop('tags_text', '')
        category_text = self.cleaned_data.pop('category_text', '').strip()
        # 处理分类：按名称获取或创建
        category = None
        if category_text:
            category, _ = Category.objects.get_or_create(name=category_text)
        self.instance.category = category
        article = super().save(commit=commit)
        if commit:
            sync_tags_to_article(article, tags_text)
        else:
            self._pending_tags_text = tags_text
        return article

    def save_m2m(self):
        super().save_m2m()
        if hasattr(self, '_pending_tags_text'):
            sync_tags_to_article(self.instance, self._pending_tags_text)


@login_required
def dashboard_home(request):
    """后台首页：统计概览。超级管理员看全站数据；普通作者只看自己的文章。"""
    is_manager = request.user.is_superuser
    if is_manager:
        articles = Article.objects.all()
    else:
        articles = Article.objects.filter(author=request.user)
    # 超管专属统计：评论总数与待审核数（用于首页概览卡片，引导处理待审队列）
    total_comments = 0
    pending_comments = 0
    if is_manager:
        total_comments = Comment.objects.count()
        pending_comments = Comment.objects.filter(
            status=COMMENT_STATUS_PENDING
        ).count()
    context = {
        'is_manager': is_manager,
        'total_articles': articles.count(),
        'total_categories': Category.objects.count() if is_manager else 0,
        'total_tags': Tag.objects.count() if is_manager else 0,
        'total_users': User.objects.count() if is_manager else 0,
        'total_comments': total_comments,
        'pending_comments': pending_comments,
        'recent_articles': articles.order_by('-created_at')[:5],
        'active': 'home',
    }
    return render(request, 'blog/dashboard/home.html', context)


@login_required
def dashboard_article_list(request):
    """文章管理列表：支持搜索与分类筛选。普通作者仅见自己文章。"""
    if request.user.is_superuser:
        qs = Article.objects.select_related('author', 'category').all()
    else:
        qs = Article.objects.select_related('author', 'category').filter(author=request.user)
    q = request.GET.get('q')
    category_id = request.GET.get('category')
    if q:
        qs = qs.filter(title__icontains=q)
    if category_id:
        qs = qs.filter(category_id=category_id)
    context = {
        'articles': qs,
        'categories': Category.objects.all(),
        'q': q or '',
        'selected_category': int(category_id) if category_id else None,
        'active': 'articles',
        'is_manager': request.user.is_superuser,
    }
    return render(request, 'blog/dashboard/article_list.html', context)


@login_required
def dashboard_article_create(request):
    """新建文章（后台视角）。普通作者发文时作者锁定为自己。"""
    is_manager = request.user.is_superuser
    if request.method == 'POST':
        form = ArticleAdminForm(request.POST)
        if not is_manager and 'author' in form.fields:
            form.fields.pop('author')
            form.instance.author = request.user
        if form.is_valid():
            form.save()
            return redirect('blog:dashboard_article_create')
    else:
        form = ArticleAdminForm(initial={'author': request.user.pk})
        if not is_manager and 'author' in form.fields:
            form.fields.pop('author')
    return render(request, 'blog/dashboard/article_form.html', {
        'form': form, 'title': '新建文章', 'submit_label': '创建', 'active': 'article_create',
        'categories': Category.objects.all(),
    })


@login_required
def dashboard_article_edit(request, pk):
    """编辑文章（后台视角）。普通作者仅能编辑自己的文章，且不能改作者。"""
    article = get_object_or_404(Article, pk=pk)
    is_manager = request.user.is_superuser
    # 普通用户只能编辑自己的文章
    if not is_manager and article.author_id != request.user.pk:
        messages.error(request, '你只能编辑自己发布的文章')
        return redirect('blog:dashboard_article_list')
    if request.method == 'POST':
        form = ArticleAdminForm(request.POST, instance=article)
        if not is_manager and 'author' in form.fields:
            # 防止普通用户通过表单抢占他人文章
            form.fields.pop('author')
            form.instance.author = request.user
        if form.is_valid():
            form.save()
            messages.success(request, '已保存文章修改')
            return redirect('blog:dashboard_article_list')
    else:
        form = ArticleAdminForm(instance=article)
        if not is_manager and 'author' in form.fields:
            form.fields.pop('author')
    return render(request, 'blog/dashboard/article_form.html', {
        'form': form, 'title': '编辑文章', 'submit_label': '保存', 'active': 'articles',
        'categories': Category.objects.all(),
    })


@login_required
def dashboard_article_delete(request, pk):
    """删除文章（后台视角）。普通作者仅能删除自己的文章。"""
    article = get_object_or_404(Article, pk=pk)
    is_manager = request.user.is_superuser
    if not is_manager and article.author_id != request.user.pk:
        messages.error(request, '你只能删除自己发布的文章')
        return redirect('blog:dashboard_article_list')
    if request.method == 'POST':
        article.delete()
        messages.success(request, '已删除文章')
        return redirect('blog:dashboard_article_list')
    return render(request, 'blog/dashboard/article_confirm_delete.html', {
        'article': article, 'active': 'articles',
    })


@admin_required
def dashboard_category_list(request):
    """分类管理列表"""
    qs = Category.objects.annotate(article_count=Count('articles'))
    if request.method == 'POST':
        form = CategoryForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('blog:dashboard_category_list')
    else:
        form = CategoryForm()
    return render(request, 'blog/dashboard/category_list.html', {
        'categories': qs, 'form': form, 'active': 'categories',
    })


@admin_required
def dashboard_category_edit(request, pk):
    """编辑分类"""
    category = get_object_or_404(Category, pk=pk)
    if request.method == 'POST':
        form = CategoryForm(request.POST, instance=category)
        if form.is_valid():
            form.save()
            return redirect('blog:dashboard_category_list')
    else:
        form = CategoryForm(instance=category)
    return render(request, 'blog/dashboard/category_form.html', {
        'form': form, 'title': '编辑分类', 'active': 'categories',
    })


@admin_required
def dashboard_category_delete(request, pk):
    """删除分类"""
    category = get_object_or_404(Category, pk=pk)
    if request.method == 'POST':
        category.delete()
        return redirect('blog:dashboard_category_list')
    return render(request, 'blog/dashboard/category_confirm_delete.html', {
        'category': category, 'active': 'categories',
    })


@admin_required
def dashboard_tag_list(request):
    """标签管理列表"""
    qs = Tag.objects.annotate(article_count=Count('articles'))
    if request.method == 'POST':
        form = TagForm(request.POST)
        if form.is_valid():
            form.save()
            return redirect('blog:dashboard_tag_list')
    else:
        form = TagForm()
    return render(request, 'blog/dashboard/tag_list.html', {
        'tags': qs, 'form': form, 'active': 'tags',
    })


@admin_required
def dashboard_tag_edit(request, pk):
    """编辑标签"""
    tag = get_object_or_404(Tag, pk=pk)
    if request.method == 'POST':
        form = TagForm(request.POST, instance=tag)
        if form.is_valid():
            form.save()
            return redirect('blog:dashboard_tag_list')
    else:
        form = TagForm(instance=tag)
    return render(request, 'blog/dashboard/tag_form.html', {
        'form': form, 'title': '编辑标签', 'active': 'tags',
    })


@admin_required
def dashboard_tag_delete(request, pk):
    """删除标签"""
    tag = get_object_or_404(Tag, pk=pk)
    if request.method == 'POST':
        tag.delete()
        return redirect('blog:dashboard_tag_list')
    return render(request, 'blog/dashboard/tag_confirm_delete.html', {
        'tag': tag, 'active': 'tags',
    })


# ===================== 用户管理（仅超级管理员） =====================
from django import forms
from django.contrib.auth.models import User


class UserEditForm(forms.ModelForm):
    """编辑用户资料、权限（可选重置密码）"""
    new_password1 = forms.CharField(
        label='新密码', required=False, strip=False,
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'autocomplete': 'new-password'}),
        help_text='留空则不修改密码',
    )
    new_password2 = forms.CharField(
        label='确认新密码', required=False, strip=False,
        widget=forms.PasswordInput(attrs={'class': 'form-control', 'autocomplete': 'new-password'}),
    )

    class Meta:
        model = User
        fields = ['username', 'email', 'first_name', 'last_name',
                  'is_active', 'is_staff', 'is_superuser']

    def clean(self):
        cd = super().clean()
        p1, p2 = cd.get('new_password1'), cd.get('new_password2')
        if p1 or p2:
            if p1 != p2:
                raise forms.ValidationError({'new_password2': '两次输入的密码不一致'})
            if len(p1) < 8:
                raise forms.ValidationError({'new_password1': '密码长度至少 8 位'})
        return cd

    def save(self, commit=True):
        user = super().save(commit=commit)
        p1 = self.cleaned_data.get('new_password1')
        if p1:
            user.set_password(p1)
            # 若仅更新密码则单独保存，避免覆盖其他字段
            if commit:
                user.save(update_fields=['password'])
        return user


@admin_required
def dashboard_user_list(request):
    """用户管理列表"""
    users = User.objects.annotate(article_count=Count('articles')).order_by('id')
    if request.method == 'POST' and 'delete_id' in request.POST:
        uid = request.POST.get('delete_id')
        target = get_object_or_404(User, pk=uid)
        # 不允许删除自己 / 不能删除唯一超级管理员
        if target.pk != request.user.pk and not (User.objects.filter(is_superuser=True).count() == 1 and target.is_superuser):
            target.delete()
        return redirect('blog:dashboard_user_list')
    return render(request, 'blog/dashboard/user_list.html', {
        'users': users, 'active': 'users',
    })


@admin_required
def dashboard_user_edit(request, pk):
    """编辑用户（资料、权限、可选重置密码）"""
    target = get_object_or_404(User, pk=pk)
    # 是否允许删除：不能删自己，也不能删唯一超级管理员
    can_delete = (target.pk != request.user.pk) and not (
        User.objects.filter(is_superuser=True).count() == 1 and target.is_superuser
    )
    if request.method == 'POST':
        form = UserEditForm(request.POST, instance=target)
        is_self = (target.pk == request.user.pk)
        if form.is_valid():
            cd = form.cleaned_data
            # 自我保护：不能把自己踢下线或锁死
            if is_self:
                if not cd.get('is_active'):
                    form.add_error('is_active', '不能停用当前登录的账户')
                if cd.get('is_superuser') is False and target.is_superuser \
                        and User.objects.filter(is_superuser=True).count() == 1:
                    form.add_error('is_superuser', '至少需要保留一名超级管理员')
            # 防止将唯一超级管理员降权（非自己操作场景）
            if (not cd.get('is_superuser')
                    and User.objects.filter(is_superuser=True).count() == 1
                    and target.is_superuser and not is_self):
                form.add_error('is_superuser', '至少需要保留一名超级管理员')
            if not form.errors:
                form.save()
                messages.success(request, f'已保存用户「{target.username}」的修改')
                return redirect('blog:dashboard_user_list')
    else:
        form = UserEditForm(instance=target)
    return render(request, 'blog/dashboard/user_form.html', {
        'form': form, 'target': target, 'active': 'users',
        'can_delete': can_delete,
    })


@admin_required
def dashboard_user_delete(request, pk):
    """删除用户确认"""
    target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        # 不允许删除自己 / 不能删除唯一超级管理员
        if target.pk != request.user.pk and not (
                User.objects.filter(is_superuser=True).count() == 1 and target.is_superuser):
            username = target.username
            target.delete()
            messages.success(request, f'已删除用户「{username}」')
        else:
            messages.error(request, '该用户不可删除（不能删除自己或唯一的超级管理员）')
        return redirect('blog:dashboard_user_list')
    return render(request, 'blog/dashboard/user_confirm_delete.html', {
        'target': target, 'active': 'users',
    })


class SetPasswordForm(forms.Form):
    """管理员为用户重置密码"""
    new_password1 = forms.CharField(label='新密码', widget=forms.PasswordInput(attrs={'class': 'form-control'}))
    new_password2 = forms.CharField(label='确认新密码', widget=forms.PasswordInput(attrs={'class': 'form-control'}))

    def clean(self):
        cd = super().clean()
        p1, p2 = cd.get('new_password1'), cd.get('new_password2')
        if p1 and p2 and p1 != p2:
            raise forms.ValidationError('两次输入的密码不一致')
        if p1 and len(p1) < 8:
            raise forms.ValidationError('密码长度至少 8 位')
        return cd


@admin_required
def dashboard_user_reset(request, pk):
    """管理员重置用户密码"""
    target = get_object_or_404(User, pk=pk)
    if request.method == 'POST':
        form = SetPasswordForm(request.POST)
        if form.is_valid():
            target.set_password(form.cleaned_data['new_password1'])
            target.save(update_fields=['password'])
            messages.success(request, f'已重置用户「{target.username}」的密码')
            return redirect('blog:dashboard_user_list')
    else:
        form = SetPasswordForm()
    return render(request, 'blog/dashboard/user_reset.html', {
        'form': form, 'target': target, 'active': 'users',
    })


# ===================== 评论功能（US1：访客发表评论） =====================

from blog.forms import CommentForm
from blog.comment_service import (
    create_comment,
    approve_comment,
    reject_comment,
    delete_comment,
)
from django.urls import reverse
import logging

logger = logging.getLogger(__name__)


@require_POST
def comment_create(request, pk):
    """前台提交评论（薄视图，仅做 HTTP 编排）。

    流程：解析文章 → 校验表单 → 调 service 落库（默认待审核）→ 重定向回文章页。
    安全：CSRF 由 Django 全局中间件保护（表单需含 {% csrf_token %}）；
    所有提交均经 CommentForm 服务端校验（FR-006），防止空内容入库。
    A1 修复点：登录用户自动将其用户名填入 author_name，无需重复填写。
    """
    article = get_object_or_404(Article, pk=pk)
    # 登录用户无需填写昵称：将用户名注入表单数据，保证校验通过（A1 修复）
    post_data = request.POST.copy()
    if request.user.is_authenticated:
        post_data['author_name'] = request.user.username
    form = CommentForm(post_data)
    if form.is_valid():
        # 登录用户自动带出昵称（解决 spec US1 AC#2），匿名用户取表单昵称
        author_name = (
            request.user.username if request.user.is_authenticated
            else form.cleaned_data['author_name']
        )
        try:
            create_comment(
                article=article,
                author_name=author_name,
                content=form.cleaned_data['content'],
                author_email=form.cleaned_data.get('author_email', ''),
                ip_address=request.META.get('REMOTE_ADDR'),
            )
            messages.success(request, '评论已提交，将在审核通过后公开展示')
        except ValueError as exc:
            # 去重等失败时友好提示，不写入数据库
            messages.warning(request, str(exc))
        return redirect('blog:article_detail', pk=pk)
    # 校验失败（空内容/超长等）：提示后重定向回文章页（评论区显示错误）
    messages.error(request, '评论提交失败，请检查填写内容')
    return redirect('blog:article_detail', pk=pk)


# ===================== 评论审核管理（US2：后台审核） =====================

@admin_required
def dashboard_comment_list(request):
    """后台评论审核列表（仅超级管理员）
    展示所有评论，支持按审核状态筛选，并提供通过/驳回/删除操作入口。
    """
    # 读取状态筛选参数，校验其合法性，非法值回退为全部
    status_filter = request.GET.get('status', '')
    valid_statuses = {code for code, _ in COMMENT_STATUS_CHOICES}
    if status_filter and status_filter not in valid_statuses:
        status_filter = ''

    # 按状态过滤；默认展示全部
    # 注意：Comment 模型无 user 字段（匿名评论设计，仅 author_name/author_email），
    # 仅 select_related('article') 优化文章关联查询
    comments = Comment.objects.select_related('article').all()
    if status_filter:
        comments = comments.filter(status=status_filter)
    comments = comments.order_by('-created_at')

    # 分页处理，每页 20 条，避免长列表一次性加载
    paginator = Paginator(comments, 20)
    page_number = request.GET.get('page')
    page_obj = paginator.get_page(page_number)

    # 构造上下文：包含筛选状态、可选状态列表、状态中文映射
    context = {
        'page_obj': page_obj,
        'comments': page_obj,  # 模板可直接遍历 comments
        'status_filter': status_filter,
        'status_choices': COMMENT_STATUS_CHOICES,
        'status_labels': dict(COMMENT_STATUS_CHOICES),
        'active': 'comments',
    }
    return render(request, 'blog/dashboard/comment_list.html', context)


@admin_required
@require_POST
def dashboard_comment_moderate(request):
    """后台评论审核动作（仅超级管理员，仅接受 POST 请求）
    接收 action（approve/reject/delete）与 comment_id，调用 comment_service 对应方法。
    操作完成后重定向回审核列表，并保留原有的状态筛选参数。
    """
    comment_id = request.POST.get('comment_id')
    action = request.POST.get('action')
    # 回跳时保留筛选状态，提升操作连贯性
    back_status = request.POST.get('status', '')

    # 参数基础校验
    if not comment_id or action not in ('approve', 'reject', 'delete'):
        messages.error(request, '请求参数不合法')
        return redirect('blog:dashboard_comment_list')

    comment = Comment.objects.filter(pk=comment_id).first()
    if not comment:
        messages.error(request, '评论不存在或已被删除')
        return redirect('blog:dashboard_comment_list')

    try:
        # 依据动作调用对应服务层方法（业务逻辑下沉到 comment_service）
        if action == 'approve':
            approve_comment(comment)
            messages.success(request, '评论已通过审核')
        elif action == 'reject':
            reject_comment(comment)
            messages.success(request, '评论已驳回')
        elif action == 'delete':
            delete_comment(comment)
            messages.success(request, '评论已删除')
    except Exception as e:
        # 捕获业务异常，记录日志并返回友好提示
        logger.error(f'评论审核操作失败: {e}', extra={
            'comment_id': comment_id,
            'action': action,
            'user_id': request.user.pk,
        })
        messages.error(request, '操作失败，请稍后重试')

    # 重定向回列表，保留筛选状态
    redirect_url = reverse('blog:dashboard_comment_list')
    if back_status:
        redirect_url += f'?status={back_status}'
    return redirect(redirect_url)


@admin_required
@require_POST
def dashboard_comment_bulk_moderate(request):
    """后台评论批量审核（仅超级管理员，仅接受 POST 请求）
    接收 action（approve/reject/delete）与 comment_ids（多个评论主键，支持同名参数或逗号分隔），
    循环调用 comment_service 对应方法，统计成功/失败数量后给出汇总提示。
    """
    action = request.POST.get('action')
    back_status = request.POST.get('status', '')

    # 收集 comment_ids：支持表单同名字段（QueryDict.getlist）或逗号分隔字符串
    raw_ids = request.POST.getlist('comment_ids')
    if not raw_ids:
        raw_ids = request.POST.get('comment_ids', '').split(',')
    raw_ids = [i for i in raw_ids if i.strip()]

    # 参数基础校验
    if action not in ('approve', 'reject', 'delete') or not raw_ids:
        messages.error(request, '请先选择评论，并指定审核动作')
        return redirect('blog:dashboard_comment_list')

    # 将字符串主键安全转为整数，过滤非法值
    try:
        comment_pks = [int(i) for i in raw_ids]
    except ValueError:
        messages.error(request, '评论标识非法')
        return redirect('blog:dashboard_comment_list')

    # 仅处理当前筛选范围内（或库内存在的）评论，避免越权操作
    comments = Comment.objects.filter(pk__in=comment_pks)
    success_count = 0
    fail_count = 0

    for comment in comments:
        try:
            if action == 'approve':
                approve_comment(comment)
            elif action == 'reject':
                reject_comment(comment)
            elif action == 'delete':
                delete_comment(comment)
            success_count += 1
        except Exception as e:
            # 单条失败不影响其余，记录日志
            fail_count += 1
            logger.error(f'批量评论审核单条失败: {e}', extra={
                'comment_id': comment.pk,
                'action': action,
                'user_id': request.user.pk,
            })

    # 汇总提示
    action_label = {'approve': '通过', 'reject': '驳回', 'delete': '删除'}.get(action, '')
    if success_count:
        messages.success(request, f'已{action_label} {success_count} 条评论')
    if fail_count:
        messages.warning(request, f'{fail_count} 条评论处理失败，请查看日志')

    # 重定向回列表，保留筛选状态
    redirect_url = reverse('blog:dashboard_comment_list')
    if back_status:
        redirect_url += f'?status={back_status}'
    return redirect(redirect_url)
