FROM python:3.12-alpine
RUN adduser -D -h /app appuser && mkdir /app/data && chown appuser /app/data
WORKDIR /app
COPY agent.py .
USER appuser
CMD ["python", "agent.py"]
