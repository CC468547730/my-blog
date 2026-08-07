from django.contrib.auth.decorators import login_not_required
from django.contrib.auth.forms import UserCreationForm
from django.contrib.auth.views import LoginView, LogoutView
from django.shortcuts import redirect
from django.urls import reverse_lazy
from django.utils.translation import gettext_lazy as _
from django.views.generic import CreateView


class RegisterView(CreateView):
    """用户注册：使用内置 UserCreationForm"""

    form_class = UserCreationForm
    template_name = 'users/register.html'
    success_url = reverse_lazy('users:login')  # 注册成功后跳转到登录页，不自动登录

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['show_sidebar'] = False
        return context

    # 不自动登录：CreateView 默认 form_valid 只保存用户并跳转到 success_url


class CustomLoginView(LoginView):
    """用户登录：使用内置 AuthenticationForm，美化模板"""

    template_name = 'users/login.html'
    redirect_authenticated_user = True

    def get_context_data(self, **kwargs):
        context = super().get_context_data(**kwargs)
        context['show_sidebar'] = False
        return context


class CustomLogoutView(LogoutView):
    """用户登出"""

    next_page = reverse_lazy('blog:article_list')
