from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    PrivateConnectView,
    PrivateConnectionListView,
    PrivateFriendAddView,
    PrivateFriendsListView,
    PrivateItemLoanViewSet,
    PrivateItemReminderDueView,
    PrivateItemReturnView,
    DirectChatThreadView,
    GroupChatThreadView,
    ChatMessageView,
    GroupMemberAddView,
    GroupMemberRemoveView,
    GroupView,
    PrivateMoneySummaryView,
    PrivateMoneyTransactionViewSet,
)

router = DefaultRouter()
router.register(r"transactions", PrivateMoneyTransactionViewSet, basename="private-transactions")
router.register(r"items", PrivateItemLoanViewSet, basename="private-items")

urlpatterns = [
    path("connect/", PrivateConnectView.as_view(), name="private-connect"),
    path("connections/", PrivateConnectionListView.as_view(), name="private-connections-list"),
    path("friends/", PrivateFriendsListView.as_view(), name="private-friends"),
    path("friends/add/", PrivateFriendAddView.as_view(), name="private-friends-add"),
    path("groups/", GroupView.as_view(), name="private-groups"),
    path("groups/<int:group_id>/add-member/", GroupMemberAddView.as_view(), name="private-groups-add-member"),
    path("groups/<int:group_id>/add-member", GroupMemberAddView.as_view()),
    path("groups/<int:group_id>/remove-member/", GroupMemberRemoveView.as_view(), name="private-groups-remove-member"),
    path("groups/<int:group_id>/remove-member", GroupMemberRemoveView.as_view()),
    path("chat/direct/", DirectChatThreadView.as_view(), name="private-chat-direct"),
    path("chat/group/<int:group_id>/", GroupChatThreadView.as_view(), name="private-chat-group"),
    path("chat/threads/<int:thread_id>/messages/", ChatMessageView.as_view(), name="private-chat-messages"),
    path("transactions/summary/", PrivateMoneySummaryView.as_view(), name="private-transaction-summary"),
    path("items/reminder-due/", PrivateItemReminderDueView.as_view(), name="private-item-reminder-due"),
    path("items/<int:pk>/return/", PrivateItemReturnView.as_view(), name="private-item-return"),
]

urlpatterns += router.urls
