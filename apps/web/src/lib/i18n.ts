import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  en: {
    translation: {
      // Navigation
      'nav.dashboard':        'Overview',
      'nav.domains':          'Protected Sites',
      'nav.modsecurity':      'WAF Rules',
      'nav.ssl':              'SSL / TLS',
      'nav.logs':             'Logs',
      'nav.alerts':           'Alerting',
      'nav.acl':              'IP Firewall',
      'nav.access-policies':  'Access Policies',
      'nav.performance':      'Performance',
      'nav.backup':           'Backup',
      'nav.users':            'Operators',
      'nav.nodes':            'Node Topology',
      'nav.network':          'Load Balancing',
      'nav.plugins':          'Plugins',

      // Login
      'login.title':    'Bạch Đằng WAF',
      'login.username': 'Username',
      'login.password': 'Password',
      'login.2fa':      '2FA Code',
      'login.signin':   'Sign In',

      // Dashboard
      'dashboard.title':    'Overview',
      'dashboard.overview': 'System Overview',
      'dashboard.domains':  'Total Domains',
      'dashboard.traffic':  'Traffic',
      'dashboard.errors':   'Errors',
      'dashboard.uptime':   'Uptime',

      // Dashboard Analytics
      'dashboard.requestTrend':        'Request Trend',
      'dashboard.requestTrendDesc':    'Real-time request statistics by HTTP status',
      'dashboard.slowRequests':        'Slow Requests',
      'dashboard.slowRequestsDesc':    'Top 10 slowest URL paths',
      'dashboard.latestAttacks':       'Latest Attacks',
      'dashboard.latestAttacksDesc':   'Top 5 attack types in 24 hours',
      'dashboard.latestNews':          'Latest Security Events',
      'dashboard.latestNewsDesc':      'Recent security incidents',
      'dashboard.requestAnalytics':    'Request Analytics',
      'dashboard.requestAnalyticsDesc':'Top 10 IP addresses by period',
      'dashboard.attackRatio':         'Attack vs Normal Requests',
      'dashboard.attackRatioDesc':     'Security threat ratio',
      'dashboard.path':                'Path',
      'dashboard.avgResponseTime':     'Avg Response Time',
      'dashboard.requestCount':        'Request Count',
      'dashboard.attackType':          'Attack Type',
      'dashboard.count':               'Count',
      'dashboard.severity':            'Severity',
      'dashboard.lastOccurred':        'Last Occurred',
      'dashboard.timestamp':           'Timestamp',
      'dashboard.attackerIp':          'Attacker IP',
      'dashboard.domain':              'Target Domain',
      'dashboard.urlPath':             'URL Path',
      'dashboard.action':              'Action',
      'dashboard.viewDetails':         'View Details',
      'dashboard.actions':             'Actions',
      'dashboard.sourceIp':            'Source IP',
      'dashboard.totalRequests':       'Total Requests',
      'dashboard.attackRequests':      'Attack Requests',
      'dashboard.normalRequests':      'Normal Requests',
      'dashboard.attackPercentage':    'Attack Percentage',
      'dashboard.period.day':          'Today',
      'dashboard.period.week':         'This Week',
      'dashboard.period.month':        'This Month',
      'dashboard.status200':           '200 OK',
      'dashboard.status301':           '301 Redirect',
      'dashboard.status302':           '302 Redirect',
      'dashboard.status400':           '400 Bad Request',
      'dashboard.status403':           '403 Forbidden',
      'dashboard.status404':           '404 Not Found',
      'dashboard.status500':           '500 Server Error',
      'dashboard.status502':           '502 Bad Gateway',
      'dashboard.status503':           '503 Unavailable',
      'dashboard.statusOther':         'Other',
      'dashboard.noData':              'No data available',

      // Domains
      'domains.title':   'Protected Sites',
      'domains.add':     'Add Domain',
      'domains.search':  'Search domains...',
      'domains.name':    'Domain Name',
      'domains.status':  'Status',
      'domains.ssl':     'SSL',
      'domains.modsec':  'ModSecurity',
      'domains.actions': 'Actions',

      // ModSecurity
      'modsec.title':  'WAF Rules',
      'modsec.global': 'Global Settings',
      'modsec.rules':  'CRS Rules',
      'modsec.custom': 'Custom Rules',

      // Common
      'common.save':     'Save',
      'common.cancel':   'Cancel',
      'common.delete':   'Delete',
      'common.edit':     'Edit',
      'common.enabled':  'Enabled',
      'common.disabled': 'Disabled',
      'common.active':   'Active',
      'common.inactive': 'Inactive',
    },
  },

  vi: {
    translation: {
      // Điều hướng
      'nav.dashboard':        'Tổng quan',
      'nav.domains':          'Tên miền bảo vệ',
      'nav.modsecurity':      'Quy tắc WAF',
      'nav.ssl':              'SSL / TLS',
      'nav.logs':             'Nhật ký',
      'nav.alerts':           'Cảnh báo',
      'nav.acl':              'Tường lửa IP',
      'nav.access-policies':  'Chính sách truy cập',
      'nav.performance':      'Hiệu năng',
      'nav.backup':           'Sao lưu',
      'nav.users':            'Vận hành viên',
      'nav.nodes':            'Cấu trúc Node',
      'nav.network':          'Cân bằng tải',
      'nav.plugins':          'Plugin',

      // Đăng nhập
      'login.title':    'Bạch Đằng WAF',
      'login.username': 'Tên đăng nhập',
      'login.password': 'Mật khẩu',
      'login.2fa':      'Mã xác thực 2FA',
      'login.signin':   'Đăng nhập',

      // Trang tổng quan
      'dashboard.title':    'Tổng quan',
      'dashboard.overview': 'Tổng quan hệ thống',
      'dashboard.domains':  'Tổng số tên miền',
      'dashboard.traffic':  'Lưu lượng',
      'dashboard.errors':   'Lỗi',
      'dashboard.uptime':   'Thời gian hoạt động',

      // Phân tích tổng quan
      'dashboard.requestTrend':        'Xu hướng yêu cầu',
      'dashboard.requestTrendDesc':    'Thống kê yêu cầu theo mã trạng thái HTTP',
      'dashboard.slowRequests':        'Yêu cầu xử lý chậm',
      'dashboard.slowRequestsDesc':    'Top 10 đường dẫn URL có thời gian phản hồi cao nhất',
      'dashboard.latestAttacks':       'Tấn công gần đây',
      'dashboard.latestAttacksDesc':   'Top 5 loại tấn công trong 24 giờ qua',
      'dashboard.latestNews':          'Sự kiện bảo mật',
      'dashboard.latestNewsDesc':      'Các sự cố bảo mật mới nhất',
      'dashboard.requestAnalytics':    'Phân tích lưu lượng',
      'dashboard.requestAnalyticsDesc':'Top 10 địa chỉ IP theo khoảng thời gian',
      'dashboard.attackRatio':         'Tỷ lệ tấn công / bình thường',
      'dashboard.attackRatioDesc':     'Tỷ lệ các mối đe dọa bảo mật',
      'dashboard.path':                'Đường dẫn',
      'dashboard.avgResponseTime':     'Thời gian phản hồi TB',
      'dashboard.requestCount':        'Số lượng yêu cầu',
      'dashboard.attackType':          'Loại tấn công',
      'dashboard.count':               'Số lượng',
      'dashboard.severity':            'Mức độ nghiêm trọng',
      'dashboard.lastOccurred':        'Lần xuất hiện gần nhất',
      'dashboard.timestamp':           'Thời điểm',
      'dashboard.attackerIp':          'IP tấn công',
      'dashboard.domain':              'Tên miền đích',
      'dashboard.urlPath':             'Đường dẫn URL',
      'dashboard.action':              'Hành động',
      'dashboard.viewDetails':         'Xem chi tiết',
      'dashboard.actions':             'Thao tác',
      'dashboard.sourceIp':            'IP nguồn',
      'dashboard.totalRequests':       'Tổng số yêu cầu',
      'dashboard.attackRequests':      'Yêu cầu bị chặn',
      'dashboard.normalRequests':      'Yêu cầu hợp lệ',
      'dashboard.attackPercentage':    'Tỷ lệ tấn công',
      'dashboard.period.day':          'Hôm nay',
      'dashboard.period.week':         'Tuần này',
      'dashboard.period.month':        'Tháng này',
      'dashboard.status200':           '200 Thành công',
      'dashboard.status301':           '301 Chuyển hướng vĩnh viễn',
      'dashboard.status302':           '302 Chuyển hướng tạm thời',
      'dashboard.status400':           '400 Yêu cầu không hợp lệ',
      'dashboard.status403':           '403 Bị từ chối',
      'dashboard.status404':           '404 Không tìm thấy',
      'dashboard.status500':           '500 Lỗi máy chủ',
      'dashboard.status502':           '502 Cổng lỗi',
      'dashboard.status503':           '503 Dịch vụ tạm ngưng',
      'dashboard.statusOther':         'Khác',
      'dashboard.noData':              'Chưa có dữ liệu',

      // Tên miền
      'domains.title':   'Tên miền bảo vệ',
      'domains.add':     'Thêm tên miền',
      'domains.search':  'Tìm kiếm tên miền...',
      'domains.name':    'Tên miền',
      'domains.status':  'Trạng thái',
      'domains.ssl':     'SSL',
      'domains.modsec':  'ModSecurity',
      'domains.actions': 'Thao tác',

      // ModSecurity
      'modsec.title':  'Quy tắc WAF',
      'modsec.global': 'Cài đặt toàn cục',
      'modsec.rules':  'Bộ quy tắc CRS',
      'modsec.custom': 'Quy tắc tùy chỉnh',

      // Chung
      'common.save':     'Lưu',
      'common.cancel':   'Hủy',
      'common.delete':   'Xóa',
      'common.edit':     'Chỉnh sửa',
      'common.enabled':  'Đang bật',
      'common.disabled': 'Đang tắt',
      'common.active':   'Hoạt động',
      'common.inactive': 'Không hoạt động',
    },
  },
};

// Read persisted language from localStorage (set on Account save)
const savedLang = localStorage.getItem('waf-language') || 'en';

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: savedLang,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false,
    },
  });

export default i18n;
