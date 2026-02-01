Starting Container
[2026-02-01 00:58:40 +0000] [1] [INFO] Starting gunicorn 22.0.0
[2026-02-01 00:58:40 +0000] [1] [INFO] Listening at: http://0.0.0.0:8080 (1)
[2026-02-01 00:58:40 +0000] [1] [INFO] Using worker: sync
[2026-02-01 00:58:40 +0000] [2] [INFO] Booting worker with pid: 2
    return wrapped(*args, **kwargs)
[2026-02-01 00:59:32,970] ERROR in app: Exception on /api/cards [GET]
Traceback (most recent call last):
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 1473, in wsgi_app
    response = self.full_dispatch_request()
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 882, in full_dispatch_request
    rv = self.handle_user_exception(e)
  File "/app/.venv/lib/python3.13/site-packages/flask_cors/extension.py", line 178, in wrapped_function
    return cors_after_request(app.make_response(f(*args, **kwargs)))
                                                ~^^^^^^^^^^^^^^^^^
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 880, in full_dispatch_request
    rv = self.dispatch_request()
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 865, in dispatch_request
    return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args)  # type: ignore[no-any-return]
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^
  File "/app/app.py", line 85, in cards
    .execute()
     ~~~~~~~^^
  File "/app/.venv/lib/python3.13/site-packages/googleapiclient/_helpers.py", line 130, in positional_wrapper
  File "/app/.venv/lib/python3.13/site-packages/googleapiclient/http.py", line 938, in execute
    raise HttpError(resp, content, uri=self.uri)
googleapiclient.errors.HttpError: <HttpError 404 when requesting https://sheets.googleapis.com/v4/spreadsheets/vg%29%7C.G4%2A%7B0%7B1%7DGf%3Dw%7D/values/Sheet1%21A%3AC?alt=json returned "Requested entity was not found.". Details: "Requested entity was not found.">
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 882, in full_dispatch_request
    rv = self.handle_user_exception(e)
  File "/app/.venv/lib/python3.13/site-packages/flask_cors/extension.py", line 178, in wrapped_function
    return cors_after_request(app.make_response(f(*args, **kwargs)))
                                                ~^^^^^^^^^^^^^^^^^
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 880, in full_dispatch_request
    rv = self.dispatch_request()
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 865, in dispatch_request
    return self.ensure_sync(self.view_functions[rule.endpoint])(**view_args)  # type: ignore[no-any-return]
           ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^^^^^^^^^^^^^
  File "/app/app.py", line 85, in cards
    .execute()
     ~~~~~~~^^
  File "/app/.venv/lib/python3.13/site-packages/googleapiclient/_helpers.py", line 130, in positional_wrapper
    return wrapped(*args, **kwargs)
  File "/app/.venv/lib/python3.13/site-packages/googleapiclient/http.py", line 938, in execute
[2026-02-01 01:09:29,871] ERROR in app: Exception on /api/cards [GET]
Traceback (most recent call last):
    raise HttpError(resp, content, uri=self.uri)
  File "/app/.venv/lib/python3.13/site-packages/flask/app.py", line 1473, in wsgi_app
googleapiclient.errors.HttpError: <HttpError 404 when requesting https://sheets.googleapis.com/v4/spreadsheets/vg%29%7C.G4%2A%7B0%7B1%7DGf%3Dw%7D/values/Sheet1%21A%3AC?alt=json returned "Requested entity was not found.". Details: "Requested entity was not found.">
    response = self.full_dispatch_request()