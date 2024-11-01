from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in trans_ms/__init__.py
from trans_ms import __version__ as version

setup(
	name="trans_ms",
	version=version,
	description="App to Manage Transportation Business.",
	author="Aakvatech Limited",
	author_email="info@aakvatech.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
