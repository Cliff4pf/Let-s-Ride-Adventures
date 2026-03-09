using SendGrid;
using SendGrid.Helpers.Mail;

namespace RideHub.Api.Services
{
    public class EmailService
    {
        private readonly string _apiKey;

        public EmailService(IConfiguration config)
        {
            _apiKey = config["SendGrid:ApiKey"] ?? string.Empty;
        }

        public async Task SendEmail(string toEmail, string subject, string body)
        {
            if (string.IsNullOrEmpty(_apiKey))
            {
                Console.WriteLine("SendGrid API key is missing. Skipping email.");
                return;
            }

            var client = new SendGridClient(_apiKey);
            var from = new EmailAddress("no-reply@ridehub.com", "RideHub");
            var to = new EmailAddress(toEmail);

            var msg = MailHelper.CreateSingleEmail(from, to, subject, body, body);
            var response = await client.SendEmailAsync(msg);
            
            if (!response.IsSuccessStatusCode)
            {
                var responseBody = await response.Body.ReadAsStringAsync();
                Console.WriteLine($"Failed to send email to {toEmail}. Status: {response.StatusCode}. Details: {responseBody}");
            }
        }
    }
}
