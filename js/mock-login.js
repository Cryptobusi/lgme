function mockLogin(e) {
  e.preventDefault();
  document.getElementById('success').style.display = 'block';
  document.getElementById('mockForm').style.display = 'none';
  return false;
}
document.getElementById('mockForm').addEventListener('submit', mockLogin);
